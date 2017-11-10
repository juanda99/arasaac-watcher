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
var localePattern = /^[A-z]{2,3}$/g
const INCLUDE = 'include'
const EXCLUDE = 'exclude'
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || 'screenshots'
const MATERIALS = process.env.MATERIALS || '/materials'
const RESOLUTION = process.env.RESOLUTION || 300
const TIME = process.env.TIME || 3000

// Initialize watcher.
var watcher = chokidar.watch(MATERIALS, {
  ignored: [/(^|[\/\\])\../, '**/screenshots_*', /index-..-(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}.tgz/],
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
    addTask(file, 'include')
  })
  .on('addDir', (dir) => {
    log(`ADDED DIRECTORY: ${path.resolve(MATERIALS, dir)}`)
    addTask(dir, 'dir')
  })
  .on('change', (file) => {
    log(`WATCHER - CHANGED FILE: ${path.resolve(MATERIALS, file)}`)
    addTask(file, 'include')
  })
  .on('unlink', (file) => {
    log(`WATCHER - REMOVED FILE: ${path.resolve(MATERIALS, file)}`)
    addTask(file, 'exclude')
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
    languages: new Set(languages),
    targetLanguages: new Set()
  }
}

const dirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory() && f.match(/^[A-z]{2,3}$/))
const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory())

const addTask = (file, operation) =>{
  let materialId = path.dirname(file).split(path.sep)[0]
  let dir = path.dirname(path.resolve(MATERIALS, file))
  // if not initialized, we do it before pushing data
  if (!materialFiles[materialId]) initMaterial(materialId)
  let material = materialFiles[materialId]
  // depending on material type we add where it should be
  // *screenshots*
  if (dir.match(/screenshots$/)|| dir.match(/screenshots\/[A-z]{2,3}$/)) material[`${operation}Screenshots`].push(file)
  // *directories*
  else if ((operation=='dir') && path.basename(file).match(/^[A-z]{2,3}$/)) material.targetLanguages.add(path.basename(file))
  else if ((operation=='dir') && !path.basename(file).match(/^[A-z]{2,3}$/)) {
    console.log(`Directory ${file} added, but not executing any action!`)
    return
  // *material files*
  } else {
    let dirName = dir.split(path.sep).pop()
    let parentDir = path.resolve(dir, '..')
    let parentDirName = parentDir.split(path.sep).pop()
    if (dirName == materialId) material.targetLanguages = material.languages    
    else if (parentDirName == materialId) material.targetLanguages.add(dirName) //dirName should be the language
    else {
      console.log(`File ${file} added, but not executing any action!`)
      return
    }
  }
  // call our actions via sync - debounce (lodash)
  operateDebounced(material)
}

// https://stackoverflow.com/questions/28787436/debounce-a-function-with-argument
var operateDebounced = _.wrap(
  _.memoize(() => _.debounce(sync, wait=TIME), _.property('materialId')), 
  (func, obj) => func(obj)(obj)
)

sync = async (material) => {
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
  try {
    if (material.targetLanguages.size) zipFiles(material)
  } catch(err) {
    console.log(err)
  }

  // reset materialId
  material = null
}

const zipFiles = async (material) => {
  // get all the ZipFiles per language
  let id = material.materialId
  try {
    let zipFiles = getZipFiles(id)
    material.targetLanguages.forEach( async (language) => {
      let languageZipFiles = getZipFile(language, zipFiles)
      languageZipFiles.forEach(async (file)=> await fs.remove(path.resolve(MATERIALS, id, file)))
      let newZip = path.resolve(MATERIALS, id, `index-${language}-${uuidv4()}.tgz`)
      let files = listFiles(path.resolve(MATERIALS, id)).filter((file)=>!languageZipFiles.includes(file))
      tar.c({gzip: true, sync: true, file: newZip, cwd: path.resolve(MATERIALS, id)}, [...files, language])
      console.log(`ZIP GENERATED: ${newZip}`)
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

const getZipFiles = (materialId, language) => {
    let filePattern = new RegExp(`^index-..-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.tgz$`, 'i')
    let files =  fs.readdirSync(path.resolve(MATERIALS, materialId))
    return files.filter((file) => filePattern.test(file))
}

const getZipFile = (language, zipFiles) => {
  try {
    let filePattern = new RegExp(`^index-${language}-[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}.tgz$`, 'i')
    return zipFiles.filter((file) => filePattern.test(file))
  } catch (error) {
    console.log(error)
  }
}
