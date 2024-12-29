const fs = require('fs');
const path = require('path');

function replaceSpacesInTags(filePath) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading file ${filePath}:`, err);
            return;
        }

        // Regex to find tags with spaces
        const tagPattern = /- "([\w\s-]+)"/g;

        const newData = data.replace(tagPattern, (match, tag) => {
            const newTag = tag.replace(/ /g, '-');
            return `- "${newTag}"`;
        });

        fs.writeFile(filePath, newData, 'utf8', (err) => {
            if (err) {
                console.error(`Error writing file ${filePath}:`, err);
            } else {
                console.log(`Processed file: ${filePath}`);
            }
        });
    });
}

function processDirectory(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Error reading directory ${directory}:`, err);
            return;
        }

        files.forEach((file) => {
            const filePath = path.join(directory, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error stating file ${filePath}:`, err);
                    return;
                }

                if (stats.isDirectory()) {
                    processDirectory(filePath);
                } else if (file.endsWith('.md')) {
                    replaceSpacesInTags(filePath);
                }
            });
        });
    });
}

const directory = process.argv[2];
if (!directory) {
    console.error('Please provide the directory path containing markdown files.');
    process.exit(1);
}

processDirectory(directory);
console.log('Tags with spaces have been replaced with hyphens.');