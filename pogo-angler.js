window.URL = window.URL || window.webkitURL;

(function() {

  function blob() {
    return {
      points: [],
      size: 0,
      push: function(x, y) {
        var point = {'x': x, 'y': y};
        ++this.size;
        if (!this.minX || x < this.minX.x) {
          this.minX = point;
        }
        if (!this.minY || y < this.minY.y) {
          this.minY = point;
        }
        if (!this.maxX || x > this.maxX.x) {
          this.maxX = point;
        }
        if (!this.maxY || y > this.maxY.y) {
          this.maxY = point;
        }
        this.points.push({'x': x, 'y': y});
      }
    }
  }

  function getWhiteBlobs(imageData) {
    var pixelStart, r, g, b, a, isWhite;
    var labels = [];
    var currentLabel = 0;
    var blobs = [];
    for (var labelIndex = 0; labelIndex < imageData.width * imageData.height; ++labelIndex) {
      labels[labelIndex] = -1;
    }

    function search(x, y, label) {
      pixelStart = (y * imageData.width + x) * 4;
      r = imageData.data[pixelStart];
      g = imageData.data[pixelStart + 1];
      b = imageData.data[pixelStart + 2];
      a = imageData.data[pixelStart + 3];
      var isWhite = r + g + b >= 253 * 3;
      var wasVisited = labels[y * imageData.width + x] >= 0;
      var isTraversable = isWhite && !wasVisited;
      if (isTraversable) {
        labels[y * imageData.width + x] = label;
        blobs[label] = blobs[label] || blob();
        blobs[label].push(x, y);
        // Maybe add diagonals?
        if (x + 1 < imageData.width) {
          search(x + 1, y, label);
        }
        if (y + 1 < imageData.height) {
          search(x, y + 1, label);
        }
        if (x - 1 >= 0) {
          search(x - 1, y, label);
        }
        if (y - 1 >= 0) {
          search(x, y - 1, label);
        }
      }
      return isTraversable;
    }

    for (var x = 0; x < imageData.width; ++x) {
      for (var y = 0; y < imageData.height; ++y) {
        pixelStart = (y * imageData.width + x) * 4;
        r = imageData.data[pixelStart];
        g = imageData.data[pixelStart + 1];
        b = imageData.data[pixelStart + 2];
        a = imageData.data[pixelStart + 3];
        // TODO it would be nice if isWhite were just some general function
        isWhite = r + g + b >= 254 * 3;
        if (search(x, y, currentLabel)) {
          ++currentLabel;
        }
      }
    }
    return blobs;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var screenshot = document.getElementById('screenshot-file');
    // TODO this really could use some jslint cleanup
    // TODO it might help to list out all of the blob assumptions here
    screenshot.addEventListener('change', function() {
      var file = screenshot.files[0],
          url = URL.createObjectURL(file),
          img = new Image();

      img.onload = function() {
        var context = c.getContext('2d');
        c.width = img.width;
        c.height = img.height;
        URL.revokeObjectURL(this.src);
        context.drawImage(img, 0, 0);
        var imageData = context.getImageData(0, 0, img.width, img.height);
        var blobs = getWhiteBlobs(imageData);
        var arcBlobCandidates = blobs.filter(function(blob) {
          return blob.points.length > 10;
        }).filter(function(blob) {
          // We only want blobs that are constrained to the upper portion of
          // the display, which seems to have a golden ratio between height
          // and width.  But the base point of the arc is also in the lower 90%
          // of that area, so we constrain on that.
          var maxY = blob.maxY.y;
          var topAreaHeight = imageData.width / 1.618;
          return maxY < topAreaHeight && maxY > 0.90 * topAreaHeight;
        });
        if (arcBlobCandidates.length == 1) {
          var arcBlob = arcBlobCandidates[0];
          var arcStart = arcBlob.minX;
          var arcEnd = arcBlob.maxX;
          var arcCenter = {
            'x': imageData.width / 2,
            // TODO This reallt should be just arcStart.y, but on pinsir we're
            // getting a point that's a bit too high.  Can probably do better
            // at processing the blob for the arc start.
            'y': Math.max(arcStart.y, arcEnd.y)
          };
          var dx = arcEnd.x - arcCenter.x;
          var dy = arcCenter.y - arcEnd.y;
          var angleFromCenter = Math.PI / 2 + Math.atan(dx / dy);
          var angleDegrees = angleFromCenter * 360 / (2*Math.PI);
          document.getElementById('result').innerText = angleDegrees + " degrees";
          console.log("dy: " + dy + ", dx: " + dx + ", angle: " +  angleDegrees);
        }
        else {
          console.log("Expected 1 arc blob candidate, found " + arcBlobCandidates.length);
        }
        context.putImageData(imageData, img.width, 0);
      };
      img.src = url;
    });
  });
})();