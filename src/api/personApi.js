import http from "./http";

const unwrap = (response) => {
  const body = response?.data;

  if (body?.success === false) {
    throw new Error(body.message || "Có lỗi xảy ra");
  }

  return body?.data ?? body;
};

export const getPersons = async (params = {}) => {
  const response = await http.get("/persons", { params });
  return unwrap(response);
};

export const getPersonDetail = async (id) => {
  const response = await http.get(`/persons/${id}`);
  return unwrap(response);
};

export const getPersonStatistics = async () => {
  const response = await http.get("/persons/statistics");
  return unwrap(response);
};

export const createPerson = async (data) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  const response = await http.post("/persons", formData);
  return unwrap(response);
};

export const updatePerson = async (id, data) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  const response = await http.put(`/persons/${id}`, formData);
  return unwrap(response);
};

export const deletePerson = async (id) => {
  const response = await http.delete(`/persons/${id}`);
  return unwrap(response);
};

export const getPersonFaces = async (personId) => {
  const response = await http.get(`/persons/${personId}/faces`);
  return unwrap(response);
};

export const createPersonFaces = async (personId, files) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("faces", file, file.name);
  });

  const response = await http.post(`/persons/${personId}/faces`, formData);

  return unwrap(response);
};

export const deletePersonFace = async (personId, faceId) => {
  const response = await http.delete(`/persons/${personId}/faces/${faceId}`);

  return unwrap(response);
};
