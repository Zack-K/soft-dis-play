const fs = require('fs');
const dom = fs.readFileSync('/Users/shimazakikeiichi/.gemini/antigravity/brain/00ffeed4-70ca-4faf-9723-53d84792c57b/.system_generated/doms/dom_1771657307480.json', 'utf8');
const data = JSON.parse(dom);

function findJWT(node) {
    if (node.Text && node.Text.startsWith('eyJhbG')) {
        console.log('FOUND JWT:', node.Text);
    }
    if (node.Children) {
        for (const child of node.Children) {
            findJWT(child);
        }
    }
}
findJWT(data);
