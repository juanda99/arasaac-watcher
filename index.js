// Initialize watcher.
var chokidar = require('chokidar')
var fs = require('fs-extra')
var path = require('path')
var AdmZip = require('adm-zip')
const uuidv4 = require('uuid/v4');
var recursive = require('recursive-readdir')
// var debounce = require('lodash.debounce')
const materials = '/Users/juandaniel/Code/arasaac-watcher/materials'
const _ = require ('lodash')
var watcher = chokidar.watch(materials, {
  ignored: [/(^|[\/\\])\../, '**/screenshots_*', /index-..-(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}.zip/],
  ignoreInitial: true,
  cwd: materials,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});


// Something to use when events are received.
var log = console.log.bind(console)
// Add event listeners.
watcher
  // .on('addDir', path => log(`Directory ${path} has been added`))
  .on('add', (path) => {
    log(`ADDED FILE: ${path}`)
    includeFiles(path)
  })
  .on('change', (path) => {
    log(`CHANGED FILE: ${path}`)
    excludeFiles(path) // we remove it and then we add it
    includeFiles(path)
  })
  .on('unlink', (path) => {
    log(`REMOVED FILE: ${path}`)
    excludeFiles(path)
  })
  .on('error', error => log(`WATCHER ERROR: ${error}`))
  .on('ready', () => {
    log('*******As there can be many changes on each material, it will wait 30 seconds on every material before starting processing it******')
    log('*******Initial scan complete. Ready for changes********')
  });

var materialFiles = {}

const includeFiles = (file) =>{
  let materialId = path.dirname(file).split(path.sep)[0]
  // if not initialized, we do it before pushing data 
  materialFiles[materialId] = materialFiles[materialId] || {
    materialId,
    include: [],
    exclude: [],
    includeScreenshots: [],
    excludeScreenshots: []
  }
  let expresion = /screenshots\/$/
  let isScreenshot = file.match(expresion)
  if (isScreenshot) materialFiles[materialId].includeScreenshots.push(file)
  else materialFiles[materialId].include.push(file)
  operateDebounced(materialFiles[materialId])
}

const operate = (materialFiles) =>
{
  console.log('files to add:')
  materialFiles.include.map((file)=>console.log (file))
  materialFiles.include=[]
}


const excludeFiles = (file) => {
  let materialId = path.dirname(file).split(path.sep)[0]
  // if not initialized, we do it before pushing data 
  materialFiles[materialId] = materialFiles[materialId] || {
    materialId,
    include: [],
    exclude: [],
    includeScreenshots: [],
    excludeScreenshots: []
  }
  let expresion = /screenshots\/$/
  let isScreenshot = dir.match(file)
  if (isScreenshot) materialFiles[materialId].excludeScreenshots.push(file)
  else materialFiles[materialId].exclude.push(file)
  return file
}


// https://stackoverflow.com/questions/28787436/debounce-a-function-with-argument
var operateDebounced = _.wrap(
  _.memoize(() => _.debounce(operate, wait=20000), _.property('materialId')), 
  (func, obj) => func(obj)(obj)
)

addOperation = (material) => {
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
    if (languages.length) languages.map((language) => addFileToZip(materialId, path.resolve(materials, file), language))
    else console.log (`${file} not processed: no languages found`)
  } else if (parentDirName == materialId) {
    // we generate a zip for just that language, dirName should be the language
    addFileToZip(materialId, file, dirName)
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

const addFilesToZip = async (materialId, language) => {
  try {
    let files = await getZipFiles(materialId, language)
    let newZip = path.resolve(materials, materialId, `index-${language}-${uuidv4()}.zip`)
    switch (files.length) {
      case 0:
        // new zip file
        let memZip = new AdmZip()
        filesToZip = await getFilesToZip (materialId, language)
        filesToZip.map((file) => memZip.addLocalFile(file))
        memZip.writeZip(newZip)
        break;
      case 1:
        // we make a new zip file with this value
        let oldZip = path.resolve(materials, materialId, files[0])
        let zip = new AdmZip(oldZip)
        filesToZip = await getFilesToZip(materialId, language)
        let zipEntries = zip.getEntries();
        filesToZip.map((file) => zipEntries.includes(file) || memZip.addLocalFile(file))
        zip.writeZip;
        await fs.move(oldZip, newZip)
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

const getFilesToZip = async (materialId, language) => {
  try {
    let generalFiles = await fs.readdir(path.resolve(materials, materialId))
    let localeFiles = await fs.readdir(path.resolve(materials, materialId, language))
    let zipPattern = new RegExp(`^index-..-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.zip$`, 'i')
    let generalFilesWithoutZips = generalFiles.filter((file) => !zipPattern.test(file))
    return generalFilesWithoutZips.concat(localeFiles)
  } catch (error) {
    console.log(error)
  }
}