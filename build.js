const browserify = require('browserify');
const fs = require('fs');
const path = require('path');

const b = browserify('src/index.js');
const outStream = fs.createWriteStream('docs/bundle.js');

b.bundle()
  .pipe(outStream)
  .on('finish', () => {
    console.log('Build completed successfully!');
  })
  .on('error', (err) => {
    console.error('Build error:', err);
    process.exit(1);
  });
