const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.vue')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/Dwayne/Documents/Projects/habits-social/app');
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('shadow-2xl')) {
        let newContent = content.replace(/(?<!dark:)shadow-2xl/g, 'dark:shadow-2xl');
        if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log('Updated ' + file);
            count++;
        }
    }
});
console.log('Total files updated: ' + count);
