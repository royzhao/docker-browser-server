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

module.exports = function(image, opts) {
  if (!opts) opts = {}

  var DOCKER_HOST = opts.docker || (process.env.DOCKER_HOST || '127.0.0.1').replace(/^.+:\/\//, '').replace(/:\d+$/, '').replace(/^\/.+$/, '127.0.0.1')

  var server = root()
  var wss = new WebSocketServer({server:server})
  var containers = {}

  wss.on('connection', function(connection) {
    var req = connection.upgradeReq
    var url = req.url.slice(1)
    var persist = opts.persist && !!url
    var id = url || Math.random().toString(36).slice(2)
    //TODO add user id
    //get userid and imagename
    var params = url.split('/')
      if(params.length<3){
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
      if(false){
          //close ws
          console.log("invalid image!");
          connection.close();
      }
      console.log(req.url)
      var stream = websocket(connection)
      //check is exists
    var container = containers.hasOwnProperty(id) && containers[id]
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
                        console.log(err);
                        return connection.destroy();
                    }

                    var container = containers[id] = {
                        id: id,
                        image: image,
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
                            PORT: 80
                        },
                        ports: ports,
                        volumes: opts.volumes || {}
                    }

                    if (persist) dopts.volumes['/tmp/'+id] = '/root'
                    if (opts.trusted) dopts.volumes['/var/run/docker.sock'] = '/var/run/docker.sock'

                    //TODO replace image with you wanted
                    pump(stream, docker(image, dopts), stream, function(err) {
                        console.log('error in create docker');
                        console.log(err);
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
    //TODO check docker containers is exist

  //server.get('/containers/{id}', function(req, res) {
  //  var id = req.params.id
  //  var container = containers.hasOwnProperty(id) && containers[id]
  //  if (!container) return res.error(404, 'Could not find container')
  //  res.send(container)
  //})
  //
  //server.all('/http/{id}/*', function(req, res) {
  //  var id = req.params.id
  //  var url = req.url.slice(('/http/'+id).length)
  //  var container = containers.hasOwnProperty(id) && containers[id]
  //  if (!container) return res.error(404, 'Could not find container')
  //  pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+url), res)
  //})

  //server.all('/files/{id}/*', function(req, res) {
  //  var id = req.params.id
  //  var url = req.url.slice(('/files/'+id).length)
  //  var container = containers.hasOwnProperty(id) && containers[id]
  //  if (!container) return res.error(404, 'Could not find container')
  //  pump(req, request('http://'+DOCKER_HOST+':'+container.ports.fs+url), res)
  //})

  server.all(function(req, res, next) {
    if (!opts.offline) return next()
    var id = req.connection.address().address
    //var container = containers.hasOwnProperty(id) && containers[id]
    //if (container) return pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+req.url), res)
    next()
  })

    //TODO check container is exist
  server.get('/user/{userid}/{imagename}',function(req,res,next){
        var id = req.params.userid
        var image = req.params.imagename
        console.log(id)
        console.log(image)
        next()
    })
  server.get('/bundle.js', '/-/bundle.js')
  server.get('/index.html', '/-/index.html')
  server.get('/user/{userid}/{imagename}', '/-/index.html')


  return server
}
