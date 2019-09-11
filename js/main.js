; var app = new (function($){
  var self = this;
  self.wamFileService = createFileService("http://localhost:62435");
  self.utils = {
    createUuid: create_UUID
  };
  return self;

  function create_UUID() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
  }

  function createFileService(baseUri){
    var endpoints = {
      list: "/api/DocumentStore/List",
      getToken: "/api/DocumentStore/Authorize"
    };
    function buildEndpointUrl(endpointName){
      var endpoint = endpoints[endpointName];
      if(!endpoint){
        throw new Error("Endpoint name" + endpointName + " does not exist.");
      }
      return baseUri + endpoint;
    }

    function listFilesInContainer(container, cb){
      $.ajax({
        method: "post",
        dataType: 'json',
        contentType: 'application/json',
        url: buildEndpointUrl("list"),
        data: JSON.stringify({
          container: container,
        }),
        success: function (response) {
          cb(null, response.links);
        },
        error: function( jqXHR, textStatus, errorThrown){
          cb(new Error(jqXHR.responseText));
        }
      });
    }
    function getTokenizedFileLink(name, link, cb) {
      $.ajax({
        method: "get",
        dataType: 'json',
        contentType: 'application/json',
        url: link,
        success: function (response) {
          var tokenizedLink = response.uri + response.token;
          cb(null, {tokenizedLink: tokenizedLink});
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cb(new Error(jqXHR.responseText));
        }
      });
    }
    function uploadFile(container, file, cb) {
      $.ajax({
        method: "post",
        dataType: 'json',
        contentType: 'application/json',
        url: buildEndpointUrl("getToken"),
        data: JSON.stringify({
          container: container,
          filename: file.name
        }),
        success: function (response) {
          var blobService = AzureStorage.Blob.createBlobServiceWithSas(response.baseUri, response.token);
          var summary = blobService.createBlockBlobFromBrowserFile(container,
            file.name,
            file,
            (error, result) => {
              if(error) {
                cb(error);
              } else {
                cb(null, summary);
                console.log('Upload is successful');
              }
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cb(new Error(jqXHR.responseText));
        }
      });
    }
    return {
      listFilesInContainer: listFilesInContainer,
      getTokenizedFileLink: getTokenizedFileLink,
      uploadFile: uploadFile
    }
  }
})(jQuery);


$(function (app) {
  var fileService = app.wamFileService;

  // This is the identifier for the service request. We will not know what the Work Order Id is until we
  // get a response from Maximo
  $("input[name='tempId']").val(app.utils.createUuid());

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

  function listFilesAndDirectories(){
    var tempContainer = $("input[name='tempId']").val();
    fileService.listFilesInContainer(tempContainer, function(err, data){
      if(err){
        throw err;
      }
      var fileList = data;
      var fileListDisplay = $("#filelist");
      fileListDisplay.empty();
      fileList.forEach(function(item, idx){
        addFileDownloadElement("filelist", item.name, item.link);
      });
    });
  }

  /*
    Go to WAM api and receive a link from which the document may be downloaded
   */
  function getFile(name, link){
    fileService.getTokenizedFileLink(name, link, function(err, data){
      if(err){
        throw err;
      }
      var uri = data.tokenizedLink;
      var link = document.createElement("a");
      link.download = name;
      link.href = uri;
      link.click();
    });
  }

  // Wire up the upload button
  $("#upload").click(function () {
    var fileUploader = $("#fileupload");
    var file = fileUploader[0].files[0];
    var tempContainer = $("input[name='tempId']").val();
    fileService.uploadFile(tempContainer, file, function(err, data){
      if(err){
        throw err;
      };
      fileUploader.replaceWith(fileUploader.val('').clone(true));
      listFilesAndDirectories();
    });
  });
}(app));
