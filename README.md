# California Driver's License Reader

This is a simple driver’s license reader that uses OpenCV and Tesseract to read text. It's built with ReactJS, react-webcam, OpenCV.js, and Tesseract.js.

The website scales correctly with differing screen sizes and can be used on mobile devices. It allows webcam screenshots using react-webcam or direct file uploads.

To read a driver's license, an uploaded image is converted to grayscale using OpenCV. To detect a driver's license card, OpenCV is used to apply a gaussian blur to reduce noise and detects edges using the Canny edge detection algorithm. Otsu thresholding is used to find an improved threshold to be used for Canny edge detection. Using the detected edges, the contours of the image are extracted with OpenCV. The contours are then used to draw a rectangular box on the grayscale image corresponding to an area likely to contain a driver's license card. If the size of this area reaches a certain threshold, the image is cropped to improve OCR in the next step. Next, the image is processed with Tesseract.js to recognize text on the image. This text is then processed using regular expressions to set each field of the outputted text.

Accuracy can be improved in the future with different image preprocessing variations or text detection. Alternative libraries such as easyOCR or external APIs can also be explored. Uploading scanned images of licenses can improve accuracy. Currently only California Driver's Licenses are supported.


Example:

![Screenshot 2024-03-01 at 6 22 02 PM](https://github.com/hwang1607/dl-reader/assets/54609782/03e5b509-5ccb-486a-a5bf-b5d6e172446d)

