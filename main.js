const electron = require('electron');
const url = require('url');
const path = require('path');
const { dialog } = require('electron');
const database = require('./js/database/database.js')
const fs = require('fs')//to check if file exists


const {app,BrowserWindow, Menu, ipcMain} = electron;

//Set environment
process.env.NODE_ENV='production';

let mainWindow;
let dbConnection;

// Listen for app to be ready
app.on('ready', function(){
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
        slashes:true
      }));
    //Quit app when closed
    mainWindow.on('closed',function(){

        app.quit();
    });

    //Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    //Insert menu
    Menu.setApplicationMenu(mainMenu);
});

//Create menu template
const mainMenuTemplate = [
    {
        label:'File',
        submenu: [
            {
                label: 'Close Database',
                click(){
                    closeDatabase();
                }
            },
            {
                label: 'Create Database',
                click(){
                    createDatabase();
                }
            },
            {
                label: 'Open Database',
                click(){
                    openDatabase();
                    //mainWindow.webContents.send('INITIAL_SEARCH');
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
                click(){
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
                accelerator: process.platform == 'darwin'? 'Command+Q': 'Ctrl+Q',
                click(){
                    closeDatabase();
                    app.quit();
                }
            }
        ]

    },
    {
        label: 'Edit',
        submenu: [
          {
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
    /*{
        label:'Database',
        submenu: [
            {
                label: 'Add Project',
                click(){
                    createAddProjectWindow();
                }
            }
        ]
    }*/
];

//Add developer tools item if not in prod
if(process.env.NODE_ENV != 'production'){
    mainMenuTemplate.push({
        label:'Developer Tools',
        submenu: [
            {
                label: 'Toggle DevTools',
                accelerator: process.platform == 'darwin'? 'Command+I': 'Ctrl+I',
                click(item, focusedWindow){
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
ipcMain.on('project:addWindow',function(e){
    createAddProjectWindow();

});

//Catch open add project window event
ipcMain.on('project:retrieveList',function(event, parameters){
    let projects = retrieveSearchResults(parameters, event);
});

//Catch add project event
ipcMain.on('project:add',function(e, project){
    insertProject(project);
});

//Catch update project event
ipcMain.on('project:update',function(e, project){
    updateProject(project);
});

//Catch delete project event
ipcMain.on('project:delete',function(e, projectId){
    deleteProject(projectId);
});

/*Doesn't work properly */
function exportToSpreadSheet(){
    const filter = [{name:'Database', extensions: ['db','pdb']},{name: 'All Files', extensions:['*']}];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result){
        if(!result.canceled){
            let basename = path.basename(result['filePaths'][0],'.pdb');
            basename = path.basename(basename,'.db');
            let directory = path.dirname(result['filePaths'][0]);
            let dataPath  = path.join(directory,basename)+".xlsx";
            if(!fs.existsSync(dataPath)){
                //makeDatabaseConnection(true, dataPath);
                this.dbConnection.databaseToSpreadsheet(result['filePaths'][0]);
            }else{
                displayErrorToUser('Spreadsheet Export Error',"A spreadsheet of the same name already exists.");
            }
        }
    }).catch(error =>{
        console.log(error);
    });
}

function importFromSpreadsheet(){
    const filter = [{name:'Spreadsheet', extensions: ['xlsx']},{name: 'All Files', extensions:['*']}];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result){
        if(!result.canceled){
            let basename = path.basename(result['filePaths'][0],'.xlsx');
            let directory = path.dirname(result['filePaths'][0]);
            let dataPath  = path.join(directory,basename)+".pdb";
            if(!fs.existsSync(dataPath)){
                makeDatabaseConnection(true, dataPath);
                this.dbConnection.spreadsheetToDatabase(result['filePaths'][0]);
            }else{
                displayErrorToUser('Spreadsheet Import Error',"A database of the same name already exists.");
            }
        }
    }).catch(error =>{
        console.log(error);
    });
}

//Open add project window
function createAddProjectWindow(){
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
        pathname: path.join(__dirname,'pages/addProject.html'),
        protocol: 'file',
        slashes: true
    }));
    //Free memory
    addProjectWindow.on('closed', function(){
        addProjectWindow = null;
    });
}

function sendProjectSearch(event, projects){
    event.reply('project:recieve',projects);
}

function retrieveSearchResults(parameters,event){
    //console.log(parameters);
    if(this.dbConnection!=null){
        this.dbConnection.retrieveProjectListSearch(parameters,event,sendProjectSearch);
    } else{
        return null;
    }
}

function displayErrorToUser(title,message){
    dialog.showErrorBox(title,message);
}


function closeDatabase(){
    if(this.dbConnection!=null){
        this.dbConnection.closeDatabase();
        this.dbConnection = null;
    }
}

function insertProject(project){
    if(this.dbConnection == null){
        displayErrorToUser("Project Insert Error","Open a database to insert a project into it.");
    }else{
        this.dbConnection.insertProject(project.number, project.name, project.fee, project.constructionCost, project.type, project.year, project.description, project.keywords, project.archive);
    }
}

function deleteProject(projectId){
    if(this.dbConnection == null){
        displayErrorToUser("Project Delete Error","Open a database to delete a project.");
    }else{
        this.dbConnection.deleteProject(projectId);
    }
}

function updateProject(project){
    if(this.dbConnection == null){
        displayErrorToUser("Project Update Error","Open a database to update a project.");
    }else{
        this.dbConnection.updateProject(project.projectId, project.number, project.name, project.fee, project.constructionCost, project.type, project.year, project.description, project.keywords, project.archive);
    }
}

function openDatabase(mainWindow){
    const filter = [{name:'Database', extensions: ['db','pdb']},{name: 'All Files', extensions:['*']}];
    const properties = ['openFile'];
    const options = {
        filters: filter,
        properties: properties
    };

    let filePath = dialog.showOpenDialog(mainWindow, options);
    filePath.then(function(result){
        console.log(result.canceled);
        console.log(result['filePaths'][0]);
        if(!result.canceled){
            makeDatabaseConnection(false, result['filePaths'][0]);
        }
    }).catch(error =>{
        console.log(error);
    });
}


function createDatabase(){
    const options = {
        title : "Create Database",
    }
    let filePath = dialog.showSaveDialog(mainWindow,options);
    filePath.then(function(result){
        console.log(result.canceled)
        console.log(result.filePath);
        if(!result.canceled){
            makeDatabaseConnection(true,result.filePath);
        }

    }, error =>{
        console.log(error);
    });
}

function makeDatabaseConnection(newDatabase, filePath){
    if(this.dbConnection == null){
        this.dbConnection = new database();
    }
    this.dbConnection.openDatabase(newDatabase, filePath, mainWindow);
}
