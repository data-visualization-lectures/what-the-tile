const browserify = require('browserify');
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, 'docs');
const outputFile = path.join(outputDir, 'bundle.js');
const entryFile = path.resolve(__dirname, 'src/index.js');

fs.mkdirSync(outputDir, { recursive: true });

const b = browserify(entryFile);
const outStream = fs.createWriteStream(outputFile);

b.bundle()
  .pipe(outStream)
  .on('finish', () => {
    console.log('Build completed successfully!');
  })
  .on('error', (err) => {
    console.error('Build error:', err);
    process.exit(1);
  });
