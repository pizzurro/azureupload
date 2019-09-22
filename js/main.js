; var app = new (function($){
  function createUtils(){
    /**
     * Not necessary for the solution but there must be a wam domain level unique id that
     * can be tied to the files
     * @returns {string} Unique identifier
     */
    function create_UUID() {
      var dt = new Date().getTime();
      var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
      uuid = uuid.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        var hex = (c == "x" ? r : (r & 0x3 | 0x8));
        return hex.toString(16);
      });
      return uuid;
    }
    var utils = {
      createUuid: create_UUID
    };
    return utils;
  }

  /**
   * File service supports file uploads via the WAM APIs via jQuery
   * and azure blob service via the azure-storage-blob.js client library
   * @param {string} baseUri The URI for the WAM API
   * @returns {FileService}
   * Object containing available services:
   *    *  listFilesInDirectory
   *    *  uploadFile
   *    *  getDownloadLink
   */
  function createFileService(baseUri){
    // References to wam api endpoints
    var endpoints = {
      list: "/api/DocumentStore/List",
      getToken: "/api/DocumentStore/Authorize"
    };
    /**
     * Private convenience service for use in building URI's
     * @param {string}endpointName key to use in looking up the relative path for the endpoint --
     * Key should be a property of the private createFileService.endpoints.
     * @returns {string} the full Uri for the desired WAM API endpoint
     */
    function buildEndpointUrl(endpointName){
      var endpoint = endpoints[endpointName];
      if(!endpoint){
        throw new Error("Endpoint name" + endpointName + " does not exist.");
      }
      return baseUri + endpoint;
    }

    /**
     * Get a listing of all the files in a directory.
     * @param {string} directory The directory for which a listing is desired
     * @param {Node~errorFirstCallback} cb - Returns an array of [{{name, link}}]
     */
    function listFilesInDirectory(directory, cb){
      $.ajax({
        method: "post",
        dataType: "json",
        contentType: "application/json",
        url: buildEndpointUrl("list"),
        data: JSON.stringify({
          directory: directory
        }),
        success: function (response) {
          cb(null, response);
        },
        error: function( jqXHR, textStatus, errorThrown){
          cb(new Error(jqXHR.responseText), null);
        }
      });
    }

    /**
     * Get a link that will allow the browser to download the desired file from Azure
     * @param {string} name The name of the file that is desired
     * @param {string} link The WAM API link that will return a limited use, tokenized download link
     * @param {Node~errorFirstCallback} cb returns a single {{link}}. Link containing a token that will enable download
     */
    function getDownloadLink(name, link, cb) {
      $.ajax({
        method: "get",
        dataType: "json",
        contentType: "application/json",
        url: link,
        success: function (response) {
          cb(null, {link: response.link});
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cb(new Error(jqXHR.responseText), null);
        }
      });
    }

    /**
     * Contacts the WAM API to request
     * @param {string} directory the directory where the file should be uploaded.
     * @param {File} file the file input containing the selected file
     * @param {Node~errorFirstCallback} cb returns the speed summary from the upload operation
     */
    function uploadFile(directory, file, cb) {
      $.ajax({
        method: "post",
        dataType: "json",
        contentType: "application/json",
        url: buildEndpointUrl("getToken"),
        data: JSON.stringify({
          directory: directory,
          filename: file.name
        }),
        success: function (response) {
          var blobService = AzureStorage.Blob.createBlobServiceWithSas(response.host, response.token);
          var summary = blobService.createBlockBlobFromBrowserFile(response.container,
            response.filepath,
            file,
            function(error, result) {
              if(error) {
                cb(error, null);
              } else {
                cb(null, summary);
                console.log("Upload is successful");
              }
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cb(new Error(jqXHR.responseText), null);
        }
      });
    }
    return {
      listFilesInDirectory: listFilesInDirectory,
      getDownloadLink: getDownloadLink,
      uploadFile: uploadFile
    };
  }
  var myApp = {};
  //
  // TODO: Inject the base url for the API
  //
  myApp.wamFileService = createFileService("http://localhost:62435");
  myApp.utils = createUtils();
  return myApp;
})(jQuery);


$(function (app) {
  var fileService = app.wamFileService;

  // This is the identifier for the service request. We will not know what the Work Order Id is until we
  // get a response from Maximo
  //
  // TODO: Inject this from the work order controller
  //
  $("input[name='tempId']").val(app.utils.createUuid());

  /**
   * Updates a container with a button and label.  When clicked the button will call getFile to download it.
   * @param {string} id the element that will contain the file list
   * @param [string} name the label for the file -- most likely the file name
   * @param {string} link the link that will be used to acquire a token for the file
   */
  function addFileDownloadElement(id, name, link){
    var $container = $("<div>", {style: "margin-bottom: 5px;"});
    var $filename = $("<div>", {style: "display: inline-block;"}).append("<span/>").text(name);
    var $dlButton = $("<button>", {type: "button", style: "margin-right: 10px;"});
    $dlButton.click(function(){
      getFile(name, link);
    });
    $dlButton.text("Download");
    $container.append($dlButton, $filename);

    $("#" + id).append($container);
  }

  /**
   * Adds the files in a directory to the filelist element in the page
   */
  function updateUploadedFileList(){
    //
    // TODO: Find a better way to grab the id.  This will align to a subdirectory in Azure
    //
    var dir = $("input[name='tempId']").val() + "/";
    fileService.listFilesInDirectory(dir, function(err, data){
      if(err){
        throw err;
      }
      var fileList = data;
      var fileListDisplay = $("#filelist");
      fileListDisplay.empty();
      fileList.forEach(function(item, idx){
        addFileDownloadElement("filelist", item.displayName, item.link);
      });
    });
  }

  /**
   * Go to WAM api and receive a link from which the document may be downloaded.  Once the link is returned, the link
   * is clicked and downloaded to the browser (assumes that the Content-Disposition element has been set appropriately
   * @param {string} name the file name
   * @param {string} link the link to the WAM Api that will provide a link that may be used in the client browser
   */
  function getFile(name, link){
    fileService.getDownloadLink(name, link, function(err, data){
      if(err){
        throw err;
      }
      var uri = data.link;
      var a = document.createElement("a");
      a.download = name;
      a.href = uri;
      a.click();
    });
  }

  /**
   * When the page is loaded, get the id for the container. In this case, it is a temporary id set up
   * by the page on load.  This id should be replaced with one that allows for the system to identify the user
   * accessing the page and authorize access to the files
   */
  $("#upload").click(function () {
    var fileUploader = $("#fileupload");
    var file = fileUploader[0].files[0];
    //
    // TODO: find a better way to retrieve the id
    //
    var directory = $("input[name='tempId']").val() + "/";
    fileService.uploadFile(directory, file, function(err, data){
      if(err){
        throw err;
      }
      fileUploader.replaceWith(fileUploader.val("").clone(true));
      updateUploadedFileList();
    });
  });
}(app));
