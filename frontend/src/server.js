const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'static')));

app.get('/health', (req, res) => res.send('ok'));

app.listen(3000, () => console.log('Frontend serving on 3000'));
