const express = require('express');
const bodyParser = require('body-parser');
const uploadRoute = require('./routes/upload');
const verifyRoute = require('./routes/verify');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/upload', uploadRoute);
app.use('/verify', verifyRoute);

const PORT = process.env.PORT || 3000;

// Catch-all route for frontend, ensuring everything is routed to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
