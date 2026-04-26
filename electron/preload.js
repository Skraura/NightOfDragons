const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close:    () => ipcRenderer.invoke('window:close'),
  },

  session: {
    setUser:      (a) => ipcRenderer.invoke('session:setUser', a),
    setApiKey:    (a) => ipcRenderer.invoke('session:setApiKey', a),
    get:          ()  => ipcRenderer.invoke('session:get'),
    saveSettings: (a) => ipcRenderer.invoke('session:saveSettings', a),
    loadSettings: ()  => ipcRenderer.invoke('session:loadSettings'),
  },

  auth: {
    register:          (a) => ipcRenderer.invoke('auth:register', a),
    login:             (a) => ipcRenderer.invoke('auth:login', a),
    logout:            ()  => ipcRenderer.invoke('auth:logout'),
    listUsers:         ()  => ipcRenderer.invoke('auth:listUsers'),
    getCloudSettings:  ()  => ipcRenderer.invoke('auth:getCloudSettings'),
    updateRole:        (a) => ipcRenderer.invoke('auth:updateRole', a),
    updatePassword:    (a) => ipcRenderer.invoke('auth:updatePassword', a),
  },

  // Steam account handles (multiple per Firebase user)
  account: {
    add:    (a) => ipcRenderer.invoke('account:add', a),
    remove: (a) => ipcRenderer.invoke('account:remove', a),
  },

  dragon: {
    getAll:      (a) => ipcRenderer.invoke('dragon:getAll', a),
    get:         (a) => ipcRenderer.invoke('dragon:get', a),
    create:      (a) => ipcRenderer.invoke('dragon:create', a),
    update:      (a) => ipcRenderer.invoke('dragon:update', a),
    delete:      (a) => ipcRenderer.invoke('dragon:delete', a),
    getAllClan:   ()  => ipcRenderer.invoke('dragon:getAllClan'),
    setLocation: (a) => ipcRenderer.invoke('dragon:setLocation', a),
    kill:        (a) => ipcRenderer.invoke('dragon:kill', a),
  },

  boxConfig: {
    get:   (a) => ipcRenderer.invoke('boxconfig:get', a),
    save:  (a) => ipcRenderer.invoke('boxconfig:save', a),
    reset: (a) => ipcRenderer.invoke('boxconfig:reset', a),
  },

  calibration: {
    open:          (a) => ipcRenderer.invoke('calibration:open', a),
    close:         ()  => ipcRenderer.invoke('calibration:close'),
    getScreenshot: ()  => ipcRenderer.invoke('calibration:getScreenshot'),
    onInit:        (cb) => ipcRenderer.on('calibration:init', (_, data) => cb(data)),
  },

  screen: {
    getDisplays: () => ipcRenderer.invoke('screen:getDisplays'),
  },

  capture: {
    manual:          ()   => ipcRenderer.invoke('capture:manual'),
    onResult:        (cb) => ipcRenderer.on('capture:result', (_, data) => cb(data)),
    onError:         (cb) => ipcRenderer.on('capture:error',  (_, msg)  => cb(msg)),
    removeListeners: ()   => {
      ipcRenderer.removeAllListeners('capture:result')
      ipcRenderer.removeAllListeners('capture:error')
    },
  },

  hotkey: {
    set: (a) => ipcRenderer.invoke('hotkey:set', a),
    get: ()  => ipcRenderer.invoke('hotkey:get'),
  },

  data: {
    export: (a) => ipcRenderer.invoke('export:user', a),
    import: (a) => ipcRenderer.invoke('import:dragons', a),
  },

  training: {
    list:    ()  => ipcRenderer.invoke('training:list'),
    reload:  (a) => ipcRenderer.invoke('training:reload', a),
    getDir:  ()  => ipcRenderer.invoke('training:getDir'),
  },

  history: {
    get:    ()  => ipcRenderer.invoke('history:get'),
    append: (a) => ipcRenderer.invoke('history:append', a),
    clear:  ()  => ipcRenderer.invoke('history:clear'),
  },

  nestingSpot: {
    getAll: ()  => ipcRenderer.invoke('nestingSpot:getAll'),
    save:   (a) => ipcRenderer.invoke('nestingSpot:save', a),
    delete: (a) => ipcRenderer.invoke('nestingSpot:delete', a),
  },
})
