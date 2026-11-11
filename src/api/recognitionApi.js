import http from "./http";

export const recognizeWebcamFrame = async (imageBlob, cameraId) => {
  const formData = new FormData();

  formData.append("image", imageBlob, "webcam-frame.jpg");
  formData.append("camera_id", String(cameraId));

  const response = await http.post("/recognition/test", formData);

  const result = response.data;

  if (result?.success === false) {
    throw new Error(result.message || "Nhận diện thất bại");
  }

  return result?.data ?? result;
};
