#!/usr/bin/env node

var WebSocketServer = require('ws').Server
var freeport = require('freeport')
var request = require('request')
var websocket = require('websocket-stream')
var docker = require('docker-browser-console')
var root = require('root')
var url = require('url')
var send = require('send')
var path = require('path')
var pump = require('pump')
var cors = require('cors')
var net = require('net')
var xtend = require('xtend')
var run = require('docker-run')
var docker_hosts='docker2.peilong.me'
module.exports = function(redis_addr, opts) {
  var image = "ubuntu";
  if (!opts) opts = {}

  var DOCKER_PORT = opts.docker_port|| 4243
    docker_hosts = opts.docker_host
  var REDIS_ADDR = redis_addr||'redis.peilong.me:6379'
  var server = root()
  var wss = new WebSocketServer({server:server})
  var containers = {}
  var run_containers = {}
  var search_run_containers = function(res,image_id,httpPort,cb){
      var container = run_containers[image_id]
      var instance = {
          container_id:null,
          port:httpPort
      }
      console.log(container)
      console.log(run_containers)
      if(container != null) {
          if(container.status ==1 ){
              cb(res,{message:container.status_msg,code:container.status},null)
              return
          }
      }
      else{
          container = run_containers[image_id] = {
              image_id:image_id,
              hosts:docker_hosts,
              status:1,
              status_msg:'pulling image',
              instances:[]
          }
      }
      var ports = {}
      ports[httpPort] = 4470
      //create one
      var child = run(image_id, xtend(opts, {
          tty: false,
          argv:["/run/docker-run"],
          volumes:{
              "/opt/docker-run/":"/run/"
          },
          env:{
            "REDIS_ADDR":REDIS_ADDR
          },
          host:docker_hosts+":"+DOCKER_PORT,
          ports: ports
      }))

      child.on('pbegin',function(){
          console.log('begin pull image')
          cb(res,{message:"pulling image"+image_id},null)
      })

      child.on('pend',function(){
          container.status_msg = 'pull is successful!'
          container.status = 2;
      })
      child.on('json',function(json){
          instance.container_id = json.Config.Hostname
          container.status_msg = 'start is successful!'
          container.status = 3;
          container.instances.push(instance)
          cb(res,null,instance)
      })

      child.on('error', function(err) {
          //create error
          container.status_msg = 'pull is failed!';
          if(err.message){
              container.status_msg+= 'reason:['+err.message+']';
          }
          cb(res,container,null)
      })


      }

  wss.on('connection', function(connection) {
    var req = connection.upgradeReq
    var url = req.url.slice(1)
    var persist = opts.persist && !!url
    var id = url || Math.random().toString(36).slice(2)
    //TODO add user id
    //get userid and imagename
    var params = url.split('/')
      if(params.length<4){
          //close ws
          console.log("error params");
          connection.close();
      }
      //get userid and check user
      var user = params[1]
      //mock check user
      if(false){
          //close ws
          console.log("invalid user!");
          connection.close();
      }
      id = user

      //get image and check it
      var image = params[2]
      var tag = params[3]
      if(tag!="latest") {
          image = "127.0.0.1:5000/" + image;
      }
      image = image + ":" + tag;
      if(false){
          //close ws
          console.log("invalid image!");
          connection.close();
      }
      console.log(req.url)
      var stream = websocket(connection)
      //check is exists
    var container = containers.hasOwnProperty(id) && containers[id]
      //console.log(container)
    if (container){//request('http://'+DOCKER_HOST+':'+container.ports.http)
        if(container.image=== image){
            console.log("already open one!");
            connection.close();
            return
        }else{
            console.log("kill one!");
            container.connection.close();
        }
    }
        var startProxy = function(httpPort, cb) {
            if (!opts.offline) return cb(null, id+'.c.'+req.headers.host)

            var proxy = net.createServer(function(socket) {
                //TODO cancel
                pump(socket, net.connect(httpPort, DOCKER_HOST), socket)
            })

            proxy.once('error', cb)
            proxy.listen(0, function() {
                var port = proxy.address().port
                cb(null, req.headers.host.split(':')[0]+':'+port, proxy)
            })
        }


        freeport(function(err, filesPort) {
            if (err) return connection.destroy()
            freeport(function(err, httpPort) {
                if (err) return connection.destroy()
                startProxy(httpPort, function(err, subdomain, proxy) {
                    if (err) {
                        console.log("create start proxy error");
                        return connection.destroy();
                    }

                    var container = containers[id] = {
                        id: id,
                        image: image,
                        docker_run: null,
                        connection:connection,
                        host: 'http://'+subdomain,
                        ports: {http:httpPort, fs:filesPort}
                    }

                    server.emit('spawn', container)

                    var ports = {}

                    ports[httpPort] = 80
                    ports[filesPort] = 8441

                    var dopts = {
                        tty: opts.tty === undefined ? true : opts.tty,
                        env: {
                            CONTAINER_ID: container.id,
                            HOST: container.host,
                            PORT: 80,
                            CONTAINER_OBJ: container
                        },
                        ports: ports,
                        host: docker_hosts+":"+DOCKER_PORT,
                        volumes: opts.volumes || {}
                    }

                    if (persist) dopts.volumes['/tmp/'+id] = '/root'
                    if (opts.trusted) dopts.volumes['/var/run/docker.sock'] = '/var/run/docker.sock'

                    //TODO replace image with you wanted
                    pump(stream, docker(image, dopts), stream, function(err) {
                        console.log('error in create docker');
                        if (proxy) proxy.close()
                        server.emit('kill', container)
                        delete containers[id]
                    })
                })
            })
        })
  })

  server.all(cors())

  server.all(function(req, res, next) {
    var host = req.headers.host || ''
    var i = host.indexOf('.c.')

    if (i > -1) {
      var id = host.slice(0, i)
      var container = containers.hasOwnProperty(id) && containers[id]
      if (container) return pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+req.url), res)
      return res.error(404, 'Could not find container')
    }

    next()
  })

  server.get('/-/*', function(req, res) {
    send(req, req.params.glob, {root:path.join(__dirname, 'web')}).pipe(res)
  })

  server.get('/containers/{id}', function(req, res) {
    var id = req.params.id
    var container = containers.hasOwnProperty(id) && containers[id]
    if (!container) return res.error(404, 'Could not find container')
      //console.log(contain)
    return res.send({'ID':container.docker_run.id})
  })
  //TODO add commit function(maybe by golang), first stop the container and then commit
  //the reason why do not use this project is that commit is a different operation to create
  server.all(function(req, res, next) {
    if (!opts.offline) return next()
    var id = req.connection.address().address
    //var container = containers.hasOwnProperty(id) && containers[id]
    //if (container) return pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+req.url), res)
    next()
  })

  server.get('/findrunner/{imagename}',function(req,res){
       var image = req.params.imagename
        console.log("find runner image is :"+image)
        var container = run_containers[image];
        res.send(container)
  })
    //TODO check container is exist
  server.post('/createrunner/{imagename}',function(req,res,next){
        var image = req.params.imagename
        console.log(" create runner image is :"+image)
      //find a image
      freeport(function(err, httpPort){
          if(err){
              res.send(err)
          }
          search_run_containers(res,image,httpPort,function(res,err,con){
              if(res.finished){
                  return
              }else{
                  if(err){
                      res.send(err)
                  }else{
                      //return pump(req, request('http://'+con.host+':'+con.port+'/api/coderunner'), res)
                       return res.send(con)
                  }
              }

          })
      })

    })
  server.get('/bundle.js', '/-/bundle.js')
  server.get('/index.html', '/-/index.html')
  server.get('/user/{userid}/{imagename}/{tag}', '/-/index.html')
  //server.get('/containers/{id}','/-/index.html')


  return server
}
