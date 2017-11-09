// load dependencies
var chokidar = require('chokidar')
var fs = require('fs-extra')
var path = require('path')
const uuidv4 = require('uuid/v4');
var recursive = require('recursive-readdir')
var tar = require('tar')
const _ = require ('lodash')
var sharp = require('sharp')

// load environment
require('dotenv').config()

// global variables and constants
var materialFiles = {}
var expresion = /screenshots\/$/ // regex for screenshots dir
var localePattern = /^[A-z]{2,3}$/g
const INCLUDE = 'include'
const EXCLUDE = 'exclude'
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || 'screenshots'
const MATERIALS = process.env.MATERIALS || '/materials'
const RESOLUTION = process.env.RESOLUTION || 300
const TIME = process.env.TIME || 3000

// Initialize watcher.
var watcher = chokidar.watch(MATERIALS, {
  ignored: [/(^|[\/\\])\../, '**/screenshots_*', /index-..-(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}.zip/],
  ignoreInitial: true,
  cwd: MATERIALS
})


// Something to use when events are received.
var log = console.log.bind(console)
// Add event listeners.
watcher
  // .on('addDir', path => log(`Directory ${path} has been added`))
  .on('add', (file) => {
    log(`WATCHER - ADDED FILE: ${path.resolve(MATERIALS, file)}`)
    addTask(file, 'INCLUDE')
  })
  .on('change', (file) => {
    log(`WATCHER - CHANGED FILE: ${path.resolve(MATERIALS, file)}`)
    addTask(file, 'INCLUDE')
  })
  .on('unlink', (file) => {
    log(`WATCHER - REMOVED FILE: ${path.resolve(MATERIALS, file)}`)
    addTask(file, 'EXCLUDE')
  })
  .on('error', error => log(`WATCHER ERROR: ${error}`))
  .on('ready', () => {
    log(`*******As there can be many changes on each material, it will wait ${parseInt(TIME)/1000} seconds on every material before starting processing it******`)
    log('*******Initial scan complete. Ready for changes********')
  })

const initMaterial = (materialId) => {
  let languages = dirs(path.resolve(MATERIALS, materialId))
  materialFiles[materialId] = {
    materialId,
    includeScreenshots: [],
    excludeScreenshots: [],
    languages: new Set(),
    targetLanguages: new Set()
  }
}

const dirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory() && f.match(/^[A-z]{2,3}$/))

const addTask = (file, operation) =>{
  let materialId = path.dirname(file).split(path.sep)[0]
  // if not initialized, we do it before pushing data
  if (!materialFiles[materialId]) initMaterial(materialId)
  let material = materialFiles[materialId]
  // depending on material type we add where it should be
  if (file.match(expresion)) material[`${operation}Screenshots`].push(file)
  else {
    let dir = path.dirname(path.resolve(MATERIALS, file))
    let dirName = dir.split(path.sep).pop()
    let parentDir = path.resolve(dir, '..')
    let parentDirName = parentDir.split(path.sep).pop()
    if (dirName == materialId) {
      material.targetLanguages = material.Languages
      operateDebounced(material)
    } else if (parentDirName == materialId) {
      material.targetLanguages.add(dirName) //dirName should be the language
      operateDebounced(material])  
    } else console.log(`File ${file} added, but not executing any action!`)
  }
}

// https://stackoverflow.com/questions/28787436/debounce-a-function-with-argument
var operateDebounced = _.wrap(
  _.memoize(() => _.debounce(sync, wait=TIME), _.property('materialId')), 
  (func, obj) => func(obj)(obj)
)

sync = (material) => {
  // remove files from screenshosts_300
  material.excludeScreenshots.map((file) => {
    file.replace('screenshots', `_${RESOLUTION}`)
    // delete the file from screenshots)
    fs.remove(path.resolve(MATERIALS, file), err => {
      if (err) console.error(err)
      else console.log(`REMOVE SCREENSHOT: ${file}`)
    })
  })
  // add screenshots to screenshots_300
  material.includeScreenshots.map((file) => resizeImage (file, material.materialId, RESOLUTION))

  // zip files 
  if (!isEmpty(material.targetLanguages)) zipFiles (material.materialId)

  // reset materialId
  initMaterial(material.materialId)
}

const zipFiles = async (material) => {
  // get all the ZipFiles per language
  try {
    let zipFiles = await getZipFiles(material.materialId)
    material.targetLanguages.forEach((language) => {
      let languageZipFiles = getZipFile(language, zipFiles)
      languageZipFiles.forEach((file)=> await fs.delete(oldZip, newZip))
      let newZip = path.resolve(MATERIALS, materialId, `index-${language}-${uuidv4()}.zip`)
      let files = fs.readdirSync(path.resolve(MATERIALS, material.materialId)).filter((file)=>!fs.lstatSync(file).isDirectory())
      let files2 = files.map((file)=>path.basename(file))
      return tar.c({gzip: true, file: newZip, cwd: MATERIALS}, [...files2, language])
    })
  } catch (error) {
    console.error(error);
  }
}

const resizeImage = (file, materialId, size) => {
  let extension = path.extname(file)
  if (extension==='.png'||extension==='.jpg'||extension==='.jpeg'|| extension==='.gif') {
    let newDir = path.resolve(MATERIALS, path.dirname(file), '..', `${SCREENSHOTS_DIR}_${size}`)
    fs.ensureDir(newDir)
    .then(() => {
      let fileName = path.basename(file)
      sharp(`${MATERIALS}/${file}`)
      .resize(null, parseInt(size))
      .toFile(`${newDir}/${fileName}`, function(err) {
        if (err) console.log(`Errorr generating screenshotfile:${err}`)
        else console.log(`GENERATE SCREENSHOT: ${newDir}/${fileName}`)
      })
    })
    .catch(err => {
      console.log(`Error creating dir for screenshots:${err}`)
    })
  }
}

const getZipFiles = async (materialId, language) => {
  try {
    let files = await fs.readdir(path.resolve(MATERIALS, materialId))
    let filePattern = new RegExp(`^index-..-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.zip$`, 'i')
    return files.filter((file) => filePattern.test(file))
  } catch (error) {
    console.log(error)
  }
}

const getZipFile = (language, zipFiles) => {
  try {
    let filePattern = new RegExp(`^index-${language}-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.zip$`, 'i')
    return zipFiles.filter((file) => filePattern.test(file))
  } catch (error) {
    console.log(error)
  }
}

const isEmpty = (obj) => {
  for(var key in obj) {
      if(obj.hasOwnProperty(key))
          return false
  }
  return true
}
