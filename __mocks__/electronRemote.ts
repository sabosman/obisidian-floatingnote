// Mock for '@electron/remote' (fallback path used by tryElectronRemote)

export const mockRemoteWin = {
    setAlwaysOnTop: jest.fn(),
    setVisibleOnAllWorkspaces: jest.fn(),
    setOpacity: jest.fn(),
};

export const BrowserWindow = {
    getFocusedWindow: jest.fn().mockReturnValue(mockRemoteWin),
};

module.exports = { BrowserWindow, mockRemoteWin };
