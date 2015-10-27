var Watcher = require('./watcher')
var middleware = require('./middleware')
var tinylr = require('tiny-lr')
var lrServer = tinylr.Server
var corsMiddleware = require('./cors-middleware')
var http = require('http')
var connect = require('connect')
var printSlowNodes = require('broccoli-slow-trees')

exports.serve = serve
function serve (builder, options) {
  options = options || {}
  var server = {}

  console.log('Serving on http://' + options.host + ':' + options.port + '\n')

  server.watcher = options.watcher || new Watcher(builder)

  server.app = connect();
  if (options.cors) {
      server.app.use(corsMiddleware);
  }
  server.app = server.app.use(middleware(server.watcher))

  server.http = http.createServer(server.app)

  server.watcher.watch()
    .catch(function(err) {
      console.log(err && err.stack || err)
    })
    .finally(function() {
      builder.cleanup()
      server.http.close()
    })
    .catch(function(err) {
      console.log('Cleanup error:')
      console.log(err && err.stack || err)
    })
    .finally(function() {
      process.exit(1)
    })

  // We register these so the 'exit' handler removing temp dirs is called
  function cleanupAndExit() {
    return server.watcher.quit()
  }

  function liveReload() {
      lrServer.changed({ body :  { files : ['livereload_dummy'] } })
  }

  process.on('SIGINT', cleanupAndExit)
  process.on('SIGTERM', cleanupAndExit)

  server.watcher.on('change', function() {
    printSlowNodes(builder.outputNodeWrapper)
    console.log('Built - ' + Math.round(builder.outputNodeWrapper.buildState.totalTime) + ' ms @ ' + new Date().toString())
    liveReload()
  })

  server.watcher.on('error', function(err) {
    console.log('Built with error:')
    console.log(err.message)
    if (!err.broccoliPayload || !err.broccoliPayload.location.file) {
      console.log('')
      console.log(err.stack)
    }
    console.log('')
    liveReload()
  })

  server.http.listen(parseInt(options.port, 10), options.host)
  lrServer.listen(options.liveReloadPort, function(err) {
      if (err) {
        console.log('Failed to start the live reload server', err)
      } else {
        console.log('Live reload server started on', options.liveReloadPort)
      }
  });
  return server
}
