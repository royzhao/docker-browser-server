#!/usr/bin/env node

var minimist = require('minimist')
var docker = require('./')

var argv = minimist(process.argv, {
  alias: {port:'p',redis_addr:'r',docker_host:'dh', docker_port:'dp', help:'h'},
  default: {port:process.env.PORT || 8080}
})

var redis_addr = argv.redis_addr

if (argv.help || !redis_addr || !argv.docker_host) {
  console.log('Usage: docker-browser-server [options]')
  console.log()
  console.log('  --port,    -p  [8080]          (port to listen on)')
  console.log('  --docker_host,  -dh')
  console.log('  --docker_port,  -dp')
  console.log('  --redis_addr,  -r')
  return process.exit(argv.help ? 0 : 1)
}

var server = docker(redis_addr, argv)

server.on('spawn', function(container) {
  console.log('Spawning new container (%s)', container.id)
})

server.on('kill', function(container) {
  console.log('Killing container (%s)', container.id)
})

server.on('listening', function() {
  console.log('Server is listening on port %d', server.address().port)
})

server.listen(argv.port)
