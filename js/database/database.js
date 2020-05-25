//database.js
/**Handles creating, manipualting, retrieving, and deleting projects and their data */
var sqlite = require('sqlite3'); //Used for the database storing project data
const { dialog } = require('electron');
const electron = require('electron');
const path = require('path'); //Used for opening, creating, and saving excel and databse files
const readXlsxFile = require('read-excel-file/node'); //Read excel spreadsheet//https://www.npmjs.com/package/read-excel-file
var xl = require('excel4node'); //For writing excel spreadsheets//https://www.npmjs.com/package/excel4node


/**
 * Represents the library of projects.
 */
class Database {
    static newestDatabaseVersion = '1.0.0'; //If a database is opened with greater version give an error, if lower upgrade database
    dbPath; //File path to current database being manipualted
    open; //True if a database is currently open
    db; //The database current;y open
    constructor() {
        this.open = false;
        this.dbPath = '';
    }

    /**
     * Opens the databse at the filepath, if no database exists it will create a new one.
     * It checks the version of the database compared to the newest version the software is aware of.
     * If the version of the databse is lower it will send the database to be upgraded to the newest version.
     * If the version of the database is greater than the newest the software is aware of an error is displayed.
     * 
     * @param {*} newDatabase //True if a new databse should be created 
     * @param {*} fPath //The file path to the database
     * @param {*} mainWindow //A reference tot he main window for displaying errors 
     */
    openDatabase(newDatabase, fPath, mainWindow) {
        if (this.dbPath != null || this.open == true) {
            this.closeDatabase();
            this.open = false;
        }

        if (newDatabase) {
            fPath = this.checkPathExtension(fPath);
        }

        this.dbPath = fPath;
        this.db = new sqlite.Database(fPath, (error) => {
            if (error) {
                console.error(error.message);
                this.displayErrorToUser("Database Error", error.message);
            } else {
                if (newDatabase) {
                    this.createDatabse();
                } else {
                    this.checkVersion();
                }

            }
        });
    }

    /**
     * Appends the pdb file extension to the database file 
     * @param {*} fPath File path the new database is being stored
     */
    checkPathExtension(fPath) {
        let ext = path.extname(fPath);
        if (ext == '') {
            fPath = fPath + '.pdb';
        } else if (ext == '.') {
            fpath = fPath + 'pdb';
        } else {

        }
        return path.normalize(fPath);
    }


    /**
     * Creates a new databse 
     */
    createDatabse() {

        this.db.run('CREATE TABLE IF NOT EXISTS project(project INTEGER PRIMARY KEY AUTOINCREMENT, project_number TEXT, project_name TEXT, fee INTEGER, construction_cost INTEGER, project_type TEXT, year INTEGER, description TEXT, keywords TEXT, archive INTEGER)');

        this.db.run('CREATE TABLE version(version INTEGER PRIMARY KEY AUTOINCREMENT, version_number TEXT)', (error) => { this.insertVersion(this.db, this.newestDatabaseVersion) });

        this.open = true;
    }

    /**
     * Inserts the version of the database it is.
     * @param {*} db //the databse being used
     * @param {*} version //The version of the database
     */
    insertVersion(db, version) {
        let insertVersionSQL = "INSERT INTO version(version_number) VALUES(?)";
        db.run(insertVersionSQL, [Database.newestDatabaseVersion], (error) => {
            if (error) {
                console.error(error.message);
                this.displayErrorToUser("Database Creation Error", error.message + " Yes this error");
            }
        });
    }

    /**
     * Shows an error message to the user
     * @param {*} title The title of the error box
     * @param {*} message The error description
     */
    displayErrorToUser(title, message) {
        dialog.showErrorBox(title, message);
    }

    /**
     * Checks the version of the database being opened. If it is older it will migrate it to the newest version
     */
    checkVersion() {
        var sql = "SELECT name FROM sqlite_master WHERE type='table' AND name='version'";
        this.db.all(sql, [], (error, rows) => {
            if (error || rows == undefined || rows.length <= 0) {
                this.displayErrorToUser("Invalid Database Version", "Version number of database not found. No version table.");
            } else {
                sql = "SELECT version_number FROM version ORDER BY version DESC LIMIT 1";
                this.db.all(sql, [], (error, rows) => {
                    if (rows != undefined && rows.length >= 1) {
                        let ver = rows[0];
                        if (ver < this.newestDatabaseVersion) {
                            this.migrateDatabase();
                        } else if (ver > this.newestDatabaseVersion) {
                            this.displayErrorToUser("Invalid Databse Version", "Database version greater than this software supports.");
                        } else {
                            this.createDatabse();
                        }

                    } else {
                        console.log(error);
                        console.log(rows);
                        this.displayErrorToUser("Invalid Database", "Version number of database not found. No version in table.");
                    }
                });
            }
        });
    }

    /**Updates the database to the newest version available.*/
    migrateDatabase() {
        //When changes happen to the database add code to upgrade older databases to the newest model.
    }

    /**
     * Closes the current database file
     */
    closeDatabase() {
        if (this.open) {
            this.db.close((err) => {
                if (err) {
                    return console.error(err.message);
                }
            });
            this.open == false;
        }
    }

    /**
     * Convert an excel spreadsheet to the databse model
     * @param {*} spreadsheetPath The file path to the spreadsheet being converted
     */
    spreadsheetToDatabase(spreadsheetPath) {
        readXlsxFile(spreadsheetPath).then((rows) => {
            // `rows` is an array of rows
            // each row being an array of cells.
            console.log(rows);
            let projectNumberIndex = 0;
            let nameIndex = 1;
            let archiveIndex = 2;
            let year = null;
            for (let i = 1; i < rows.length; i++) {
                //Check if year row. If so fill in empty year 
                if (rows[projectNumberIndex][0] != null && rows[i][nameIndex] == null && rows[i][archiveIndex] == null) {
                    year = rows[i][0];
                } else {
                    this.insertProject(rows[i][projectNumberIndex], rows[i][nameIndex], '', '', '', year, '', '', rows[i][archiveIndex]);
                }
            }
        });
    }

    /**
     * Converts a database to an excel spreadsheet
     * @param {*} spreadsheetPath Path to save the spreadsheet
     */
    databaseToSpreadsheet(spreadsheetPath) {
        let sql = 'SELECT * FROM project ORDER BY project_number ASC';
        let write = this.writeExcel;

        this.db.all(sql, [], function(err, rows) {
            if (err) {

            } else {
                write(rows, spreadsheetPath);
            }
        });

    }

    //Write to an excel sheet
    writeExcel(rows, path) {
        var wb = new xl.Workbook();
        var style = wb.createStyle({
            font: {
                color: '#FF0800',
                size: 12,
            },
            numberFormat: '$#,##0.00; ($#,##0.00); -',
        });
        var ws = wb.addWorksheet('Sheet 1');

        for (let y = 0; y < rows.length; y++) {
            for (let x = 0; x < rows[y].length; x++) {
                ws.cell(x, y).string(rows[y][x])
            }
        }
        wb.write(path);

    }

    /**
     * Removes a project and its data from the database.
     * @param {*} projectId The identifier for the project being deleted 
     */
    deleteProject(projectId) {
        let sql = 'DELETE FROM project WHERE project=' + String(projectId);
        let data = [];
        this.db.run(sql, data, (error) => {
            if (error) {
                console.log(error);
                this.displayErrorToUser("Delete Project Error", "There was an issue with deleting a project in the database.");
            }
        });
    }

    /**
     * Create a new project in the database
     * @param {*} projectNumber The number identifier of the project
     * @param {*} projectName The title of the project
     * @param {*} fee The fee charged for doing this project
     * @param {*} constructionCost The cost of construction for this project
     * @param {*} projectType The type of project the project is
     * @param {*} year The year the project started
     * @param {*} description A description of the project
     * @param {*} keywords Keywords associated with the project, used to assist in the search function
     * @param {*} archive The archive nubmer the project is archived to
     */
    insertProject(projectNumber, projectName, fee = null, constructionCost = null, projectType = null, year = null, description = null, keywords = null, archive = null) {
        let sql = 'INSERT INTO project(project_number, project_name, fee, construction_cost, project_type, year, description, keywords, archive) VALUES(?,?,?,?,?,?,?,?,?)';
        let data = [projectNumber, projectName, fee, constructionCost, projectType, year, description, keywords, archive];
        this.db.run(sql, data, (error) => {
            if (error) {
                console.log(error);
                this.displayErrorToUser("Add Project Error", "There was an issue with adding a project to the database.");
            }
        });
    }

    /**
     * Update the data of a project
     * @param {*} projectId The database id for the project
     * @param {*} projectNumber The number identifier of the project
     * @param {*} projectName The title of the project
     * @param {*} fee The fee charged for doing this project
     * @param {*} constructionCost The cost of construction for this project
     * @param {*} projectType The type of project the project is
     * @param {*} year The year the project started
     * @param {*} description A description of the project
     * @param {*} keywords Keywords associated with the project, used to assist in the search function
     * @param {*} archive The archive nubmer the project is archived to
     */
    updateProject(projectId, projectNumber, projectName, fee = null, constructionCost = null, projectType = null, year = null, description = null, keywords = null, archive = null) {
        let sql = 'UPDATE project SET project_number =?, project_name =?, fee=?, construction_cost=?, project_type=?, year=?, description=?, keywords=?, archive=? WHERE project=?';
        let data = [projectNumber, projectName, fee, constructionCost, projectType, year, description, keywords, archive, projectId];
        this.db.run(sql, data, (error) => {
            if (error) {
                console.log(error);
                this.displayErrorToUser("UpdateProject Error", "There was an issue with updating a project in the database.");
            }
        });
    }

    /**
     * Search for and retrieve a lsit of projects using the given parameters
     * @param {*} parameters The parameters of the search. Paremters are: number, name, fee, contruction cost, type, year,description, and keywords
     * @param {*} event Event that activated the search
     * @param {*} callBack Function for returning the project list
     */
    retrieveProjectListSearch(parameters, event, callBack) {
        var result;
        let where = false;
        let sql = 'SELECT * FROM project';
        if (parameters['projectNumber'] != '') {
            let split = parameters['projectNumber'].split('');
            let join = split.join('%');
            sql += (where ? ' AND ' : ' WHERE ') + ' project_number LIKE "%' + join + '%"';
            where = true;
        }
        if (parameters['projectName'] != '') {
            /*let split = parameters['projectName'].split('');
            let join = split.join('%');
            split = join.split(' ');
            join = split.join('" OR project_name LIKE "')*/
            let split = parameters['projectName'].split(' ');
            for (let i = 0; i < split.length; i++) {
                if (split[i] != ' ') {
                    split[i] = '%' + split[i] + '%';
                }
            }
            let join = split.join('" OR project_name LIKE "');
            sql += (where ? ' AND ' : ' WHERE ') + ' (project_name LIKE "' + join + '")';
            where = true;
        }

        if (parameters['feeMin'] != '' && !Number.isNaN(parseFloat(parameters['feeMin']))) {
            let feeMin = parseFloat(parameters['feeMin']);
            //Add where clause if needed
            sql += (where ? ' AND ' : ' WHERE ') + ' fee>=' + feeMin.valueOf();

            where = true;
        }

        if (parameters['feeMax'] != '' && !Number.isNaN(parseFloat(parameters['feeMax']))) {
            let feeMax = parseFloat(parameters['feeMax']);
            //Add where clause if needed
            sql += (where ? ' AND ' : ' WHERE ') + ' fee<=' + feeMax.valueOf();

            where = true;
        }

        if (parameters['constructionMin'] != '' && !Number.isNaN(parseFloat(parameters['constructionMin']))) {
            let constructionMin = parseFloat(parameters['constructionMin']);
            //Add where clause if needed
            sql += (where ? ' AND ' : ' WHERE ') + ' construction_cost>=' + constructionMin.valueOf();

            where = true;
        }

        if (parameters['constructionMax'] != '' && !Number.isNaN(parseFloat(parameters['constructionMax']))) {
            let constructionMax = parseFloat(parameters['constructionMax']);
            //Add where clause if needed
            sql += (where ? ' AND ' : ' WHERE ') + ' construction_cost<=' + constructionMax.valueOf();

            where = true;
        }
        if (parameters['projectType'] != '') {
            let split = parameters['projectType'].split('');
            let join = split.join('%');
            sql += (where ? ' AND ' : ' WHERE ') + ' project_type LIKE "%' + join + '%"';
            where = true;
        }
        if (parameters['year'] != '') {
            let split = parameters['year'].split('');
            let join = split.join('%');
            sql += (where ? ' AND ' : ' WHERE ') + ' year LIKE "%' + join + '%"';
            where = true;
        }
        if (parameters['description'] != '') {
            let split = parameters['description'].split('');
            let join = split.join('%');
            sql += (where ? ' AND ' : ' WHERE ') + ' description LIKE "%' + join + '%"';
            where = true;
        }

        if (parameters['keywords'] != '') {
            let split = parameters['keywords'].split(' ');
            for (let i = 0; i < split.length; i++) {
                if (split[i] != ' ') {
                    split[i] = '%' + split[i] + '%';
                }

            }
            let join = split.join('" OR keywords LIKE "');
            sql += (where ? ' AND ' : ' WHERE ') + ' (keywords LIKE "' + join + '")';
            where = true;
        }

        if (parameters['archive'] != '') {
            let split = parameters['archive'].split('');
            let join = split.join('%');
            sql += (where ? ' AND ' : ' WHERE ') + ' archive LIKE "%' + join + '%"';
            where = true;
        }
        sql += ' ORDER BY project_number ASC';
        this.db.all(sql, [], function(err, rows) {
            if (err) {

            } else {
                callBack(event, rows);
            }
        });
    }
}

module.exports = Database;