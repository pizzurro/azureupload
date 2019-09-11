$(function () {
  function create_UUID() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
  }

  function listFilesAndDirectories(){
    var tempContainer = $("input[name='tempId']").val();
    $.ajax({
      method: "post",
      dataType: 'json',
      contentType: 'application/json',
      url: "http://localhost:62435/api/DocumentStore/List",
      data: JSON.stringify({
        container: tempContainer,
      }),
      success: function (response) {
        var fileList = response.links;
        var fileListDisplay = $("#filelist");
        fileListDisplay.empty();
        fileList.forEach(function(item, idx){
          addFileDownloadElement("filelist", item.name, item.link);
        });
      }
    });
  }

  /*
    Go to WAM api and receive a link from which the document may be downloaded
   */
  function getFile(name, link){
    $.ajax({
      method: "get",
      dataType: 'json',
      contentType: 'application/json',
      url: link,
      success: function (response) {
        var uri = response.uri + response.token;
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        link.click();

      }
    });
  }

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

  var files = [];
  // This is the identifier for the service request. We will not know what the Work Order Id is until we
  // get a response from Maximo
  $("input[name='tempId']").val(create_UUID());
  $("#simulateUpload").click(function(){
    var file = create_UUID().replace('-', '') + ".txt";
    files = files.concat(file);
    $("#filelist").empty();
    files.forEach(function(f){
      addFileDownloadElement("filelist", f);
    });


  });
  // Wire up the upload button
  $("#upload").click(function () {
    var fileUploader = $("#fileupload");
    var file = fileUploader[0].files[0];
    var tempContainer = $("input[name='tempId']").val();
    $.ajax({
      method: "post",
      dataType: 'json',
      contentType: 'application/json',
      url: "http://localhost:62435/api/DocumentStore/Authorize",
      data: JSON.stringify({
        container: tempContainer,
        filename: file.name
      }),
      success: function (response) {
        var blobService = AzureStorage.Blob.createBlobServiceWithSas(response.baseUri, response.token);
        blobService.createBlockBlobFromBrowserFile(tempContainer,
          file.name,
          file,
          (error, result) => {
            if(error) {
              // Handle blob error
            } else {
              // Replace the file input element to clear it -- works in more browsers
              fileUploader.replaceWith(fileUploader.val('').clone(true));
              listFilesAndDirectories();
              console.log('Upload is successful');
            }
          });
      }
    });
  });
});
