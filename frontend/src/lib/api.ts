import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Unwrap backend response: { success, data } -> data
api.interceptors.response.use((res) => {
  if (res.data && typeof res.data === "object" && "data" in res.data) {
    res.data = res.data.data;
  }
  return res;
});

// Groups
export const getGroups = () => api.get("/groups");
export const createGroup = (data: any) => api.post("/groups", data);
export const updateGroup = (id: string, data: any) =>
  api.put(`/groups/${id}`, data);
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`);
export const toggleScan = (id: string) =>
  api.patch(`/groups/${id}/toggle-scan`);

// Rooms
export const getRooms = () => api.get("/rooms");
export const createRoom = (data: FormData) =>
  api.post("/rooms", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateRoom = (id: string, data: FormData) =>
  api.put(`/rooms/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteRoom = (id: string) => api.delete(`/rooms/${id}`);
export const postRoomToGroups = (id: string, groupIds: string[]) =>
  api.post(`/rooms/${id}/post`, { groupIds });

// Posts
export const getPosts = (params?: string) =>
  api.get(`/posts${params ? "?" + params : ""}`);
export const getPostStats = () => api.get("/posts/stats");

// Comments
export const getComments = (params?: string) =>
  api.get(`/comments${params ? "?" + params : ""}`);

// Settings
export const getSettings = () => api.get("/settings");
export const updateSettings = (data: any) => api.put("/settings", data);

// Post Logs
export const getPostLogs = (params?: string) =>
  api.get(`/post-logs${params ? "?" + params : ""}`);

// Auth
export const fbLogin = (data: {
  email?: string;
  password?: string;
  cookies?: string;
}) => api.post("/auth/fb-login", data);
export const fbStatus = () => api.get("/auth/fb-status");
export const fbLogout = () => api.post("/auth/fb-logout");

// Scan
export const startScan = (groupId?: string) =>
  api.post("/scan/start", groupId ? { groupId } : {});
export const getScanStatus = () => api.get("/scan/status");
export const startAutoScan = () => api.post("/scan/auto-start");
export const stopAutoScan = () => api.post("/scan/auto-stop");
export const analyzePosts = (limit = 20) =>
  api.post("/scan/analyze", { limit });

// FB Accounts
export const getFbAccounts = () => api.get("/fb-accounts");
export const createFbAccount = (data: { email: string; password: string }) =>
  api.post("/fb-accounts", data);
export const updateFbAccount = (
  id: string,
  data: { email?: string; password?: string },
) => api.put(`/fb-accounts/${id}`, data);
export const deleteFbAccount = (id: string) => api.delete(`/fb-accounts/${id}`);
export const loginFbAccount = (id: string) =>
  api.post(`/fb-accounts/${id}/login`);
export const logoutFbAccount = (id: string) =>
  api.post(`/fb-accounts/${id}/logout`);
export const checkFbAccountStatus = (id: string) =>
  api.get(`/fb-accounts/${id}/status`);
export const saveFbAccountCookies = (id: string, cookies: string) =>
  api.post(`/fb-accounts/${id}/save-cookies`, { cookies });
export const setFbAccountActive = (id: string) =>
  api.post(`/fb-accounts/${id}/set-active`);

export default api;
