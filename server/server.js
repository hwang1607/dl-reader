const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

app.post('/upload', upload.single('image'), (req, res) => {
  const path = req.file.path;
  Tesseract.recognize(
    path,
    'eng'
  ).then(({ data: { text } }) => {
    console.log(text);
    res.json({ text });
  })
  .catch(err => {
    console.error(err);
    res.status(500).send('Error processing the image');
  });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
