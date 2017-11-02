// Initialize watcher.
var chokidar = require('chokidar')
var fs = require('fs-extra')
var path = require('path')
var glob = require('glob')
var AdmZip = require('adm-zip')
var recursive = require('recursive-readdir')
const materials = '/home/juanda/arasaac-watcher/materials'
var watcher = chokidar.watch(materials, {
  ignored: [/(^|[\/\\])\../, '*.zip', '**/screenshots_*'],
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
    addOperation (path)
    resizeImages(path)
    addFileToZip(path)
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

  addOperation = (file) => {
    // depending in where the file is added we will generate images or zip files:
    let dir = path.dirname(file)
    let parentDir = dir.split(path.sep).pop()
    let materialId = dir.split(path.sep)[0]
    let expresion = /screenshots$/
    isScreenshot = dir.match(expresion)
    if (isScreenshot) resizeImages(file, materialId, 300)
    elseif (dir == materialId)
      // if file is in idMaterial/ we add that file for all languages
    
    elseif (parentDir == materialId)
      // we generate a zip for just that language


  }

  function resizeImages (file, materialId, size) {
    let extension = path.extname(file)
    if (isScreenshot && (extension==='.png'||extension==='.jpg'||extension==='.jpeg'|| extension==='.gif')) {
      let newDir = `${path.dirname(file).split(path.sep).pop().pop()}${path.sep}screenshots_${size}` 
      // let newDir = `${materials}/${materialId}/screenshots_300`
      fs.ensureDir(newDir)
      .then(() => {
        console.log('success!')
        let fileName = path.basename(file)
        sharp(`${materials}/${file}`)
        .resize(null, size)
        .toFile(`${newDir}/${fileName}`, function(err) {
          if (err) console.log(`Errorr generating screenshotfile:${err}`)
        })
      })
      .catch(err => {
        console.log(`Error creating dir for screenshots:${err}`)
      })
    }
  }
  
  function addFileToZip (materialId, file, language) {
    // get scope (one language, or all languages)


  }