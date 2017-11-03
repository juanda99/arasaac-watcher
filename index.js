// Initialize watcher.
var chokidar = require('chokidar')
var fs = require('fs-extra')
var path = require('path')
var glob = require('glob')
var AdmZip = require('adm-zip')
const uuidv4 = require('uuid/v4');
var recursive = require('recursive-readdir')
const materials = '/Users/juandaniel/Code/arasaac-watcher/materials'
var watcher = chokidar.watch(materials, {
  ignored: [/(^|[\/\\])\../, '**/screenshots_*', /index-..-(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}.zip/],
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
  .on('add', path => addOperation (path))
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
    console.log (`File ${file} has been added`)
    let relativeDir = path.dirname(file)
    let dir = `${materials}/${relativeDir}`
    let dirName = dir.split(path.sep).pop()
    let parentDir = path.resolve(dir, '..')
    let parentDirName = parentDir.split(path.sep).pop()
    let materialId = path.dirname(file).split(path.sep)[0]
    let expresion = /screenshots$/
    let isScreenshot = dir.match(expresion)
    if (isScreenshot) { 
      resizeImages(file, materialId, 300)
    } else if (dirName == materialId) {
      // if file is in the root folder we need to modify zip for all languages:
      let languages = dirs(dir)
      if (languages.length) languages.map((language) => addFileToZip(materialId, file, language))
      else console.log (`${file} not processed: no languages found`)
    } else if (parentDir == materialId) {
      // we generate a zip for just that language
    } else {
      console.log(`File ${file} added, but not executing any action!`)
    }

  }

  const dirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory())

  const resizeImages = (file, materialId, size) => {
    let extension = path.extname(file)
    if (extension==='.png'||extension==='.jpg'||extension==='.jpeg'|| extension==='.gif') {
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
  
  const addFileToZip = async (materialId, file, language) => {
    try {
      let files = await getZipFiles(materialId, language)
      let newFile = path.resolve(materials, materialId, `index-${language}-${uuidv4()}.zip`)
      switch (files.length) {
        case 0:
          // new zip file
          let memZip = new AdmZip()
          memZip.addLocalFile(path.resolve(materials,file))
          memZip.writeZip(newFile)
          break;
        case 1:
          // we make a new zip file with this value
          let zip = new AdmZip(files[0])
          zip.addLocalFile(path.resolve(materials, file))
          await fs.move(file, newFile)
          break;
        default:
          throw new Error(`Found more than one zip file for language ${language} in materials ${materialId} folder`);
      }
      //should be just one file!
    } catch (error) {
      console.error(error);
    }
      
  }
  const getZipFiles = async (materialId, language) => {
    try {
      let files = await fs.readdir(path.resolve(materials, materialId))
      let filePattern = new RegExp(`^index-${language}-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.zip$`, 'i')
      return files.filter((file) => filePattern.test(file))
    } catch (error) {
      console.log(error)
    }
}