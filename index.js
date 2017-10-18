// Initialize watcher.
var chokidar = require('chokidar');
const materials = '/Users/juandaniel/Code/arasaac-watcher/materials/'
var watcher = chokidar.watch(materials, {
  ignored: [/(^|[\/\\])\../, '*.zip'],
  ignoreInitial: true,
  cwd: materials
});

// Something to use when events are received.
var log = console.log.bind(console);
// Add event listeners.
watcher
  .on('change', path => log(`File ${path} has been changed`))
  .on('unlink', path => log(`File ${path} has been removed`));

// More possible events.
watcher
  .on('addDir', path => log(`Directory ${path} has been added`))
  .on('add', path => log(`File ${path} has been added`))
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