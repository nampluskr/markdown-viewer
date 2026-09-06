const { contextBridge, ipcRenderer } = require("electron");

const invoke = (method) => (...args) => ipcRenderer.invoke("bridge", method, ...args);
contextBridge.exposeInMainWorld("bridge", {
  choose_root: invoke("choose_root"),
  set_root: invoke("set_root"),
  get_recent_folders: invoke("get_recent_folders"),
  clear_recent_folders: invoke("clear_recent_folders"),
  list_children: invoke("list_children"),
  minimize: invoke("minimize"),
  toggle_maximize: invoke("toggle_maximize"),
  close: invoke("close"),
  get_settings: invoke("get_settings"),
  save_settings: invoke("save_settings"),
  call_domain: invoke("call_domain"),
});
ipcRenderer.on("window-state", (_event, maximized) => window.dispatchEvent(new CustomEvent("window-state", { detail: maximized })));
window.addEventListener("DOMContentLoaded", () => window.dispatchEvent(new Event("bridge-ready")));