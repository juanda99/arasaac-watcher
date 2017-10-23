// Initialize watcher.
var chokidar = require('chokidar')
var fs = require('fs-extra')
var path = require('path')
var sharp = require('sharp')
const materials = '/home/juanda/arasaac-watcher/materials'
var watcher = chokidar.watch(materials, {
  ignored: [/(^|[\/\\])\../, '*.zip'],
  ignoreInitial: true,
  cwd: materials
});


// Something to use when events are received.
var log = console.log.bind(console)
// Add event listeners.
watcher
  .on('change', path => log(`File ${path} has been changed`))
  .on('unlink', path => log(`File ${path} has been removed`))

// More possible events.
watcher
  .on('addDir', path => log(`Directory ${path} has been added`))
  .on('add', path => {
    log(`File ${path} has been added`)
    resizeImages(path)
  })
  .on('unlinkDir', path => log(`Directory ${path} has been removed`))
  .on('error', error => log(`Watcher error: ${error}`))
  .on('ready', () => {
    log('*******Initial scan complete. Ready for changes********')
  });
  /*
  // for debuggin purposes, see  https://github.com/paulmillr/chokidar/issues/590
  .on('raw', (event, path, details) => {
    log('Raw event info:', event, path, details);
  });
  */



  function resizeImages (file) {
    let extension = path.extname(file)
    let dir = path.dirname(file)
    let expresion = /screenshots$/
    isScreenshot = dir.match(expresion)
    if (isScreenshot && (extension==='.png'||extension==='.jpg'||extension==='.jpeg'|| extension==='.gif')) {
      let materialId = dir.split(path.sep)[0]
      let newDir = `${materials}/${materialId}/screenshots_300`
      fs.ensureDir(newDir)
      .then(() => {
        console.log('success!')
        let fileName = path.basename(file)
        sharp(`${materials}/${file}`)
        .resize(null, 300)
        .toFile(`${newDir}/${fileName}`, function(err) {
          if (err) console.log(`Errorr generating screenshotfile:${err}`)
        })
      })
      .catch(err => {
        console.log(`Error creating dir for screenshots:${err}`)
      })
    }
  }