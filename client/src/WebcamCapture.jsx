import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  Fragment,
} from "react";
import Webcam from "react-webcam";
import cv from "@techstark/opencv-js";
import Tesseract from "tesseract.js";

const WebcamCapture = () => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [webcamError, setWebcamError] = useState(false);
  const [extractedData, setExtractedData] = useState({
    firstName: "",
    lastName: "",
    address: "",
    issuanceDate: "",
    expirationDate: "",
  });
  const [ocrProcessing, setOcrProcessing] = useState(false); // State to track OCR processing

  useEffect(() => {
    cv.onRuntimeInitialized = () => {
      console.log("OpenCV loaded");
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        processImageToGrayscale(e.target.result);
      };
      reader.readAsDataURL(file);
      event.target.value = ""; // Reset the file input after uploading
    }
  };

  const processImageToGrayscale = (imageSrc) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0, img.width, img.height);
  
      const src = cv.imread(canvas);
      setOcrProcessing(true); // Indicate OCR processing starts
  
      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  
      // Apply Gaussian Blur and Canny Edge Detection 
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5, 1.5, cv.BORDER_DEFAULT);
      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 100, 200);
  
      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
      // Find the largest contour and its bounding rectangle
      let maxArea = 0;
      let bestRect = null;
      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt, false);
        if (area > maxArea) {
          maxArea = area;
          const rect = cv.boundingRect(cnt);
          bestRect = rect;
        }
      }
  
      if (bestRect) {
        // Crop the grayscale image to the largest contour
        const x = bestRect.x, y = bestRect.y, width = bestRect.width, height = bestRect.height;
        const roi = new cv.Rect(x, y, width, height);
        const cropped = gray.roi(roi);
        // Use the cropped image with the existing processImageWithTesseract function
        processImageWithTesseract(cropped, canvas, context);
      } else {
        processImageWithTesseract(gray, canvas, context);
      }
  
      // Clean up
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
    };
    img.src = imageSrc;
  };
  
  
  const processImageWithTesseract = (grayImageMat, canvas, context) => {
    // Make sure canvas size matches the new image dimensions if it was cropped or altered
    canvas.width = grayImageMat.cols;
    canvas.height = grayImageMat.rows;

    // Convert the grayscale image to RGBA format to display it using canvas
    const rgbaDst = new cv.Mat();
    cv.cvtColor(grayImageMat, rgbaDst, cv.COLOR_GRAY2RGBA);

    // Ensure the processedImgData is correctly sized for the canvas
    const processedImgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      canvas.width,  // Use updated width
      canvas.height  // Use updated height
    );
    context.putImageData(processedImgData, 0, 0);
    setImgSrc(canvas.toDataURL());
  
    // The rest of the OCR processing using Tesseract.js
    Tesseract.recognize(
      canvas.toDataURL(),
      "eng",
      { logger: (m) => console.log(m) }
    ).then(({ data: { text } }) => {
      console.log("OCR Result:", text);
      const parsedData = parseDriverLicenseData(text);
      setExtractedData(parsedData); // Update state with parsed data
      setOcrProcessing(false); // Indicate OCR processing is complete
    }).catch((err) => {
      console.error("Error during OCR:", err);
      setOcrProcessing(false); // Handle errors in OCR processing
    });
  
    rgbaDst.delete(); // Clean up
  };
  

  const parseDriverLicenseData = (text) => {
    const data = {
      firstName: "",
      lastName: "",
      address: "",
      issuanceDate: "",
      expirationDate: "",
    };
  
    const removeSymbolsRegex = /[^a-zA-Z0-9\s,.-]/g;
    const dateRegex = /[^0-9\/]/g;
  
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].toUpperCase();
      if (lines[i].includes("LN")) {
        data.lastName = lines[i].split("LN")[1].trim().replace(removeSymbolsRegex, '');
      }
      if (lines[i].includes("FN")) {
        data.firstName = lines[i].split("FN")[1].trim().replace(removeSymbolsRegex, '');
        // Assuming the address is immediately below the last name
        if (
          lines[i + 1] &&
          !lines[i + 1].includes("EXP") &&
          !lines[i + 1].includes("ISS")
        ) {
          data.address = lines[i + 1].trim().replace(removeSymbolsRegex, '');
        }
      }
      if (lines[i].includes("EXP")) {
        let expText = lines[i].split("EXP")[1].trim(); // Get the text after "EXP"
        let firstElement = expText.split(" ")[0].replace(dateRegex, ''); // Remove unwanted symbols from date
        data.expirationDate = firstElement;
      }
      if (lines[i].includes("ISS")) {
        if (lines[i + 1]) {
          const parts = lines[i + 1].trim().split(" ");
          // Assuming the last part is the date, remove unwanted symbols from it
          data.issuanceDate = parts[parts.length - 1].replace(dateRegex, '');
        }
      }
    }
  
    return data;
  };
  

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      processImageToGrayscale(imageSrc);
    }
  }, [webcamRef]);

  return (
    <Fragment>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {ocrProcessing ? ( // Display a message based on the OCR processing state
          <div style={{ marginTop: "2vh", marginBottom: "2vh" }}>
            Processing image...
          </div>
        ) : (
          <div style={{ marginTop: "2vh", marginBottom: "2vh" }}>&nbsp;</div>
        )}
      </div>
      <div className="button-container">
        <button
          onClick={capture}
          style={{ marginTop: "0px", marginBottom: "50px" }}
        >
          Capture photo
        </button>
        <button
          style={{ marginTop: "0px", marginBottom: "50px" }}
          onClick={() => document.getElementById("fileInput").click()}
        >
          Upload photo
        </button>
      </div>
      <input
        type="file"
        id="fileInput"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <div className="content-container">
        <div className="camera">
          {!webcamError ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              forceScreenshotSourceSize
              videoConstraints={{ facingMode: "environment" }} // This line requests the rear camera
              screenshotFormat="image/jpeg"
              width="100%"
              height="100%"
              onUserMediaError={() => setWebcamError(true)}
            />
          ) : (
            <div className="DefaultBox">Webcam access denied</div>
          )}
        </div>

        {imgSrc ? (
          <img src={imgSrc} alt="Captured" className="camera" />
        ) : (
          <div className="DefaultBox">Capture or upload photo</div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ marginTop: "20px", marginBottom: "50px" }}>
          <h3>Extracted Information</h3>
          <p>
            <strong>First Name:</strong> {extractedData.firstName}
          </p>
          <p>
            <strong>Last Name:</strong> {extractedData.lastName}
          </p>
          <p>
            <strong>Address:</strong> {extractedData.address}
          </p>
          <p>
            <strong>Issuance Date:</strong> {extractedData.issuanceDate}
          </p>
          <p>
            <strong>Expiration Date:</strong> {extractedData.expirationDate}
          </p>
        </div>
      </div>
    </Fragment>
  );
};

export default WebcamCapture;
