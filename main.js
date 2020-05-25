const electron = require('electron');
const url = require('url');
const path = require('path');
const { dialog } = require('electron');
const database = require('./js/database/database.js') //To access the database functions
const fs = require('fs') //to check if file exists


const { app, BrowserWindow, Menu, ipcMain } = electron;

//Set environment
process.env.NODE_ENV = 'production'; //Set teh evironment to production for release, devlopemnt for development

let mainWindow; //The main window of the software
let dbConnection; //The database object for manipulating projects

// Listen for app to be ready
app.on('ready', function() {
    //create window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            nodeIntegration: true
        }
    });
    //Load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'mainWindow.html'),
        protocol: 'file:',
        slashes: true
    }));
    //Quit app when closed
    mainWindow.on('closed', function() {

        app.quit();
    });

    //Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    //Insert menu
    Menu.setApplicationMenu(mainMenu);
});

//Create menu template
const mainMenuTemplate = [{
        label: 'File',
        submenu: [{
                label: 'Close Database',
                click() {
                    closeDatabase();
                }
            },
            {
                label: 'Create Database',
                click() {
                    createDatabase();
                }
            },
            {
                label: 'Open Database',
                click() {
                    openDatabase();
                },
            },
            /*{
                label: 'Add To Database From Spreadsheet',
                click(){
                    addFromSpreadsheet();
                }
            },*/
            {
                label: 'Import Archive Spreadsheet',
                click() {
                    importFromSpreadsheet();
                }
            },
            /*{
                label: 'Export Archive Spreadsheet',
                click(){
                    exportToSpreadSheet();
                }
            },*/
            {
                label: 'Quit',
                accelerator: process.platform == 'darwin' ? 'Command+Q' : 'Ctrl+Q',
                click() {
                    closeDatabase();
                    app.quit();
                }
            }
        ]

    },
    {
        label: 'Edit',
        submenu: [{
                label: 'Undo',
                accelerator: 'CommandOrControl+Z',
                role: 'undo',
            },
            {
                label: 'Redo',
                accelerator: 'Shift+CommandOrControl+Z',
                role: 'redo',
            },
            { type: 'separator' },
            {
                label: 'Cut',
                accelerator: 'CommandOrControl+X',
                role: 'cut',
            },
            {
                label: 'Copy',
                accelerator: 'CommandOrControl+C',
                role: 'copy',
            },
            {
                label: 'Paste',
                accelerator: 'CommandOrControl+V',
                role: 'paste',
            },
            {
                label: 'Select All',
                accelerator: 'CommandOrControl+A',
                role: 'selectall',
            },
        ],
    },
];

//Add developer tools item if not in prod
if (process.env.NODE_ENV != 'production') {
    mainMenuTemplate.push({
        label: 'Developer Tools',
        submenu: [{
                label: 'Toggle DevTools',
                accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
                click(item, focusedWindow) {
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'reload'
            }
        ]
    });
};

//Catch open add project window event
//Opens an add project window
ipcMain.on('project:addWindow', function(e) {
    createAddProjectWindow();

});

//Catch open add project window event
/**
 * Searchs for projects and return the list of the ones found
 */
ipcMain.on('project:retrieveList', function(event, parameters) {
    let projects = retrieveSearchResults(parameters, event);
});

/**
 * Catch add project event
 * Inserts a project into the database
 * */
ipcMain.on('project:add', function(e, project) {
    insertProject(project);
});

/**
 * Catch update project event
 * Changes changes teh data stored in a project
 */
ipcMain.on('project:update', function(e, project) {
    updateProject(project);
});

//Catch delete project event
ipcMain.on('project:delete', function(e, projectId) {
    deleteProject(projectId);
});

/**Doesn't work properly
 * Exports a project database to an excel spreadsheet 
 */
function exportToSpreadSheet() {
    const filter = [{ name: 'Database', extensions: ['db', 'pdb'] }, { name: 'All Files', extensions: ['*'] }];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result) {
        if (!result.canceled) {
            let basename = path.basename(result['filePaths'][0], '.pdb');
            basename = path.basename(basename, '.db');
            let directory = path.dirname(result['filePaths'][0]);
            let dataPath = path.join(directory, basename) + ".xlsx";
            if (!fs.existsSync(dataPath)) {
                //makeDatabaseConnection(true, dataPath);
                this.dbConnection.databaseToSpreadsheet(result['filePaths'][0]);
            } else {
                displayErrorToUser('Spreadsheet Export Error', "A spreadsheet of the same name already exists.");
            }
        }
    }).catch(error => {
        console.log(error);
    });
}

/**
 * Opens an excel spreadsheet with project information and creates a database witht he information.
 */
function importFromSpreadsheet() {
    const filter = [{ name: 'Spreadsheet', extensions: ['xlsx'] }, { name: 'All Files', extensions: ['*'] }];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result) {
        if (!result.canceled) {
            let basename = path.basename(result['filePaths'][0], '.xlsx');
            let directory = path.dirname(result['filePaths'][0]);
            let dataPath = path.join(directory, basename) + ".pdb";
            if (!fs.existsSync(dataPath)) {
                makeDatabaseConnection(true, dataPath);
                this.dbConnection.spreadsheetToDatabase(result['filePaths'][0]);
            } else {
                displayErrorToUser('Spreadsheet Import Error', "A database of the same name already exists.");
            }
        }
    }).catch(error => {
        console.log(error);
    });
}

/**
 * Create an add project window
 */
function createAddProjectWindow() {
    addProjectWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        },
        width: 1000,
        height: 1000,
        title: "Add New Project",
    });

    //Load HTML into window
    addProjectWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'pages/addProject.html'),
        protocol: 'file',
        slashes: true
    }));
    //Free memory
    addProjectWindow.on('closed', function() {
        addProjectWindow = null;
    });
}

/**
 * Sends the project list to the main view
 * @param {*} event The event which caused the search
 * @param {*} projects The list of projects found in the search
 */
function sendProjectSearch(event, projects) {
    event.reply('project:recieve', projects);
}

/**
 * Get the project list from a search in the database
 * @param {*} parameters The parameters of the search
 * @param {*} event The event causing the search
 */
function retrieveSearchResults(parameters, event) {
    //console.log(parameters);
    if (this.dbConnection != null) {
        this.dbConnection.retrieveProjectListSearch(parameters, event, sendProjectSearch);
    } else {
        return null;
    }
}

/**
 * Displays an error message to the user
 * @param {*} title The title of the error
 * @param {*} message The error description
 */
function displayErrorToUser(title, message) {
    dialog.showErrorBox(title, message);
}


/**
 * Closes the database connection
 */
function closeDatabase() {
    if (this.dbConnection != null) {
        this.dbConnection.closeDatabase();
        this.dbConnection = null;
    }
}

/**
 * Create a new project in the database
 * @param {*} project The project informtion
 */
function insertProject(project) {
    if (this.dbConnection == null) {
        displayErrorToUser("Project Insert Error", "Open a database to insert a project into it.");
    } else {
        this.dbConnection.insertProject(project.number, project.name, project.fee, project.constructionCost, project.type, project.year, project.description, project.keywords, project.archive);
    }
}

/**
 * Delete a project from the database
 * @param {*} projectId The id of the project to be deleted
 */
function deleteProject(projectId) {
    if (this.dbConnection == null) {
        displayErrorToUser("Project Delete Error", "Open a database to delete a project.");
    } else {
        this.dbConnection.deleteProject(projectId);
    }
}

/**
 * Update a project's information
 * @param {*} project New project information
 */
function updateProject(project) {
    if (this.dbConnection == null) {
        displayErrorToUser("Project Update Error", "Open a database to update a project.");
    } else {
        this.dbConnection.updateProject(project.projectId, project.number, project.name, project.fee, project.constructionCost, project.type, project.year, project.description, project.keywords, project.archive);
    }
}

/**
 * Open a connection to a database
 * @param {*} mainWindow The main window of the application
 */
function openDatabase(mainWindow) {
    const filter = [{ name: 'Database', extensions: ['db', 'pdb'] }, { name: 'All Files', extensions: ['*'] }];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result) {
        if (!result.canceled) {
            makeDatabaseConnection(false, result['filePaths'][0]);
        }
    }).catch(error => {
        console.log(error);
    });
}

/**
 * Create a new database
 */
function createDatabase() {
    const options = {
        title: "Create Database",
    }
    let filePath = dialog.showSaveDialog(mainWindow, options);
    filePath.then(function(result) {
        if (!result.canceled) {
            makeDatabaseConnection(true, result.filePath);
        }

    }, error => {
        console.log(error);
    });
}

/**
 * Make a database connection
 * @param {*} newDatabase True if the databse connection is to a newly made database, false otherwise
 * @param {*} filePath File path to the database 
 */
function makeDatabaseConnection(newDatabase, filePath) {
    if (this.dbConnection == null) {
        this.dbConnection = new database();
    }
    this.dbConnection.openDatabase(newDatabase, filePath, mainWindow);
}