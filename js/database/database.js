//database.js
var sqlite = require('sqlite3');
const { dialog } = require('electron');
const electron = require('electron');
const path = require('path');
const readXlsxFile = require('read-excel-file/node');//Read excel spreadsheet//https://www.npmjs.com/package/read-excel-file
var xl = require('excel4node');//For writing excel spreadsheets//https://www.npmjs.com/package/excel4node


class Database{
    static newestDatabaseVersion = '1.0.0';//If a database is opened with greater version give an error, if lower upgrade database
    dbPath;
    open;
    db;
    constructor(){
        this.open = false;
        this.dbPath = '';
    }

    openDatabase(newDatabase, fPath, mainWindow){
        if(this.dbPath!=null || this.open == true){
            this.closeDatabase();
            this.open = false;
        }

        if(newDatabase){
            fPath = this.checkPathExtension(fPath);
        }

        this.dbPath = fPath;
        this.db = new sqlite.Database(fPath,(error) =>{
            if(error){
                console.error(error.message);
                this.displayErrorToUser("Database Error",error.message);
            }else{
                if(newDatabase){
                    this.createDatabse();
                }else{
                    this.checkVersion();  
                }
                
            }
        });
        //this.db.close();
    }

    checkPathExtension(fPath){
        let ext = path.extname(fPath);
        if(ext == ''){
            fPath = fPath+'.pdb';
        }else if(ext == '.'){
            fpath = fPath+'pdb';
        }else{

        }
        return path.normalize(fPath);
    }


    createDatabse(){

        this.db.run('CREATE TABLE IF NOT EXISTS project(project INTEGER PRIMARY KEY AUTOINCREMENT, project_number TEXT, project_name TEXT, fee INTEGER, construction_cost INTEGER, project_type TEXT, year INTEGER, description TEXT, keywords TEXT, archive INTEGER)');
        
        this.db.run('CREATE TABLE version(version INTEGER PRIMARY KEY AUTOINCREMENT, version_number TEXT)', (error)=>{this.insertVersion(this.db, this.newestDatabaseVersion)});
        
        
        this.open = true;
    }

    insertVersion(db, version){
        let insertVersionSQL = "INSERT INTO version(version_number) VALUES(?)";
        db.run(insertVersionSQL,[Database.newestDatabaseVersion],(error)=>{
            if(error){
                console.error(error.message);
                this.displayErrorToUser("Database Creation Error",error.message+" Yes this error");
            }
        });
    }

    displayErrorToUser(title,message){
        dialog.showErrorBox(title,message);
    }

    checkVersion(){
        var sql = "SELECT name FROM sqlite_master WHERE type='table' AND name='version'";
        this.db.all(sql,[],(error, rows)=>{
            if(error || rows==undefined ||rows.length<=0){
                this.displayErrorToUser("Invalid Database Version", "Version number of database not found. No version table.");
            }else{
                sql = "SELECT version_number FROM version ORDER BY version DESC LIMIT 1";
                this.db.all(sql,[],(error, rows)=>{
                    if(rows != undefined && rows.length>=1){
                        let ver = rows[0];
                        if(ver < this.newestDatabaseVersion){
                            this.migrateDatabase();
                        }else if(ver>this.newestDatabaseVersion){
                            this.displayErrorToUser("Invalid Databse Version", "Database version greater than this software supports.");
                        }else{
                            this.createDatabse();
                        }

                    }else{
                        console.log(error);
                        console.log(rows);
                        this.displayErrorToUser("Invalid Database", "Version number of database not found. No version in table.");
                    }
                    
                    
                });
                
            }

        });
    }

    /**Updates the database to the newest version available.*/
    migrateDatabase(){

    }

    closeDatabase(){
        if(this.open){
            this.db.close((err) => {
                if (err) {
                  return console.error(err.message);
                }
              });
            this.open == false;
        }
    }

    spreadsheetToDatabase(spreadsheetPath){
        readXlsxFile(spreadsheetPath).then((rows) => {
            // `rows` is an array of rows
            // each row being an array of cells.
            console.log(rows);
            let projectNumberIndex =0;
            let nameIndex = 1;
            let archiveIndex = 2;
            let year= null;
            for(let i=1;i<rows.length;i++){
                //Check if year row. If so fill in empty year 
                if(rows[projectNumberIndex][0]!=null && rows[i][nameIndex]==null&&rows[i][archiveIndex]==null){
                    year = rows[i][0];
                }else{
                    this.insertProject(rows[i][projectNumberIndex],rows[i][nameIndex], '', '', '', year, '', '',rows[i][archiveIndex]);
                }
            }
            
          })
    }

    databaseToSpreadsheet(spreadsheetPath){
        let sql = 'SELECT * FROM project ORDER BY project_number ASC';
        let write = this.writeExcel;

        this.db.all(sql,[],function(err, rows) {
            if(err){

            }else{
                write(rows, spreadsheetPath);
            }
        });
        
    }

    writeExcel(rows,path){
        var wb = new xl.Workbook();
        var style = wb.createStyle({
            font: {
              color: '#FF0800',
              size: 12,
            },
            numberFormat: '$#,##0.00; ($#,##0.00); -',
          });
        var ws = wb.addWorksheet('Sheet 1');
        
        for(let y=0;y<rows.length;y++){
            for(let x=0;x<rows[y].length;x++){
                ws.cell(x,y).string(rows[y][x])
            }
        }
        console.log(path);
        wb.write(path);
        
    }


    deleteProject(projectId){
        let sql = 'DELETE FROM project WHERE project='+String(projectId);
        console.log(sql);
        let data = [];
        this.db.run(sql,data, (error)=>{
            if(error){
                console.log(error);
                this.displayErrorToUser("Delete Project Error","There was an issue with deleting a project in the database.");
            }
        });
    }

    insertProject(projectNumber, projectName , fee = null, constructionCost = null, projectType = null, year = null, description = null, keywords = null, archive = null){
        let sql = 'INSERT INTO project(project_number, project_name, fee, construction_cost, project_type, year, description, keywords, archive) VALUES(?,?,?,?,?,?,?,?,?)';
        let data = [projectNumber,projectName,fee,constructionCost,projectType, year, description,keywords, archive];
        this.db.run(sql,data, (error)=>{
            if(error){
                console.log(error);
                this.displayErrorToUser("Add Project Error","There was an issue with adding a project to the database.");
            }
        });
    }

    updateProject(projectId, projectNumber, projectName , fee = null, constructionCost = null, projectType = null, year = null, description = null, keywords = null, archive = null){
        let sql = 'UPDATE project SET project_number =?, project_name =?, fee=?, construction_cost=?, project_type=?, year=?, description=?, keywords=?, archive=? WHERE project=?';
        let data = [projectNumber,projectName,fee,constructionCost,projectType, year, description,keywords, archive, projectId];
        this.db.run(sql,data, (error)=>{
            if(error){
                console.log(error);
                this.displayErrorToUser("UpdateProject Error","There was an issue with updating a project in the database.");
            }
        });
    }


    retrieveProjectListSearch(parameters,event, callBack){
        var result;
        let where = false;
        let sql = 'SELECT * FROM project';
        if(parameters['projectNumber']!=''){
            let split = parameters['projectNumber'].split('');
            let join = split.join('%');
            sql+= (where?' AND ':' WHERE ') + ' project_number LIKE "%' + join+'%"';
            where=true;
        }
        if(parameters['projectName']!=''){
            /*let split = parameters['projectName'].split('');
            let join = split.join('%');
            split = join.split(' ');
            join = split.join('" OR project_name LIKE "')*/
            let split = parameters['projectName'].split(' ');
            for(let i=0;i<split.length;i++){
                if(split[i]!=' '){
                    split[i]= '%'+split[i]+'%';
                }
            }
            let join = split.join('" OR project_name LIKE "');
            sql+= (where?' AND ':' WHERE ') + ' (project_name LIKE "' + join +'")';
            where=true;
        }

        if(parameters['feeMin']!=''  && !Number.isNaN(parseFloat(parameters['feeMin']))){
            let feeMin = parseFloat(parameters['feeMin']);
            //Add where clause if needed
            sql += (where?' AND ':' WHERE ')+ ' fee>='+feeMin.valueOf();

            where = true;
        }

        if(parameters['feeMax']!=''  && !Number.isNaN(parseFloat(parameters['feeMax']))){
            let feeMax = parseFloat(parameters['feeMax']);
            //Add where clause if needed
            sql += (where?' AND ':' WHERE ')+ ' fee<='+feeMax.valueOf();

            where = true;
        }

        if(parameters['constructionMin']!=''  && !Number.isNaN(parseFloat(parameters['constructionMin']))){
            let constructionMin = parseFloat(parameters['constructionMin']);
            //Add where clause if needed
            sql += (where?' AND ':' WHERE ')+ ' construction_cost>='+constructionMin.valueOf();

            where = true;
        }

        if(parameters['constructionMax']!=''  && !Number.isNaN(parseFloat(parameters['constructionMax']))){
            let constructionMax = parseFloat(parameters['constructionMax']);
            //Add where clause if needed
            sql += (where?' AND ':' WHERE ')+ ' construction_cost<='+constructionMax.valueOf();

            where = true;
        }
        if(parameters['projectType']!=''){
            let split = parameters['projectType'].split('');
            let join = split.join('%');
            sql+= (where?' AND ':' WHERE ') + ' project_type LIKE "%' + join+'%"';
            where=true;
        }
        if(parameters['year']!=''){
            let split = parameters['year'].split('');
            let join = split.join('%');
            sql+= (where?' AND ':' WHERE ' )+ ' year LIKE "%' +join+'%"';
            where=true;
        }
        if(parameters['description']!=''){
            let split = parameters['description'].split('');
            let join = split.join('%');
            sql+= (where?' AND ':' WHERE ') + ' description LIKE "%' +join+'%"';
            where=true;
        }

        if(parameters['keywords']!=''){
            /*let split = parameters['keywords'].split('');
            let join = split.join('%');
            split = join.split(' ');
            join = split.join('" OR keywords LIKE "')*/
            let split = parameters['keywords'].split(' ');
            for(let i=0;i<split.length;i++){
                if(split[i]!=' '){
                    split[i]= '%'+split[i]+'%';
                }
                
            }
            let join = split.join('" OR keywords LIKE "');
            sql+= (where?' AND ':' WHERE ') + ' (keywords LIKE "' + join +'")';
            where=true;
        }

        if(parameters['archive']!=''){
            let split = parameters['archive'].split('');
            let join = split.join('%');
            sql+= (where?' AND ':' WHERE ') + ' archive LIKE "%' + join+'%"';
            where=true;
        }
        sql += ' ORDER BY project_number ASC';
        console.log(sql);
        //console.log(sql);
        //this.db.serialize(
            //function(){
                this.db.all(sql,[],function(err, rows) {
                    if(err){

                    }else{
                        callBack(event,rows);
                    }
                });
           // }
        //);
        

    }

    retrieveProject(projectId){

    }
}

module.exports = Database;