// Mock for the 'electron' module used by applyWindowSettings()

export const mockWin = {
    setAlwaysOnTop: jest.fn(),
    setVisibleOnAllWorkspaces: jest.fn(),
    setOpacity: jest.fn(),
    setTitle: jest.fn(),
};

export const remote = {
    BrowserWindow: {
        getFocusedWindow: jest.fn().mockReturnValue(mockWin),
    },
};

// Also export as default so `require('electron')` works
module.exports = { remote, mockWin };
