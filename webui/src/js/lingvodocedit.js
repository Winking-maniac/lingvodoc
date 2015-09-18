'use strict';

var elan = (function() {
    var elan = {};

    var _forEach = Array.prototype.forEach;
    var _map = Array.prototype.map;

    elan.TimeSlot = function(id, value) {
        this.id = id;
        this.value = value;
    };

    elan.Annotation = function(id, value, timeslotRef1, timeslotRef2) {
        this.id = id;
        this.value = value;
        this.timeslotRef1 = timeslotRef1;
        this.timeslotRef2 = timeslotRef2;
    };

    elan.Tier = function(id, linguisticTypeRef, defaultLocale, annotations) {
        this.id = id;
        this.defaultLocale = defaultLocale;
        this.linguisticTypeRef = linguisticTypeRef;
        this.annotations = annotations;
    };

    elan.Document = function() {

        this.mediaFile = '';
        this.mediaUrl = '';
        this.mediaType = '';
        this.timeslots = [];
        this.tiers = [];

        this.lastUsedTierId = 0;
        this.lastUsedAnnoationId = 0;
        this.lastUsedTimeSlotId = 0;

        var timeslotExists = function(ts, list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].id == ts.id) {
                    return true;
                }
            }
            return false;
        };


        this.getTimeSlot = function(slotId) {
            for (var i = 0; i < this.timeslots.length; i++) {
                var timeslot = this.timeslots[i];
                if (timeslot.id == slotId) {
                    return timeslot;
                }
            }
        }.bind(this);


        this.getTimeSlotByValue = function(value) {
            for (var i = 0; i < this.timeslots.length; i++) {
                var timeslot = this.timeslots[i];
                if (timeslot.value === value) {
                    return timeslot;
                }
            }
        }.bind(this);

        this.timeSlotRefToSeconds = function(slotId) {
            var slot = this.getTimeSlot(slotId);
            if (slot) {
                return parseInt(slot.value) / 1000;
            }
        }.bind(this);


        this.getValidTimeslots = function() {
            var validTimeslots = [];
            for (var i = 0; i < this.tiers.length; i++) {
                var tier = this.tiers[i];
                for (var j = 0; j < tier.annotations.length; j++) {
                    var annotation = tier.annotations[j];
                    if (annotation instanceof elan.Annotation) {
                        var timeslot1 = this.getTimeSlot(annotation.timeslotRef1);
                        var timeslot2 = this.getTimeSlot(annotation.timeslotRef2);
                        if (typeof timeslot1 != 'undefined' && typeof timeslot2 != 'undefined') {

                            if (!timeslotExists(timeslot1, validTimeslots)) {
                                validTimeslots.push(timeslot1);
                            }

                            if (!timeslotExists(timeslot2, validTimeslots)) {
                                validTimeslots.push(timeslot2);
                            }
                        }
                    }
                }
            }

            // sort timeslots by value
            validTimeslots.sort(function(a, b) {
                if (a.value > b.value) {
                    return 1;
                }
                if (a.value < b.value) {
                    return -1;
                }
                return 0;
            });

            return validTimeslots;
        }.bind(this);

        this.getTier = function(id) {
            var tier = null;
            for (var i = 0; i < this.tiers.length; i++) {
                if (this.tiers[i].id === id) {
                    tier = this.tiers[i];
                    break;
                }
            }
            return tier;
        }.bind(this);


        this.importXML = function(xml) {

            var header = xml.querySelector('HEADER');
            var inMilliseconds = header.getAttribute('TIME_UNITS') == 'milliseconds';
            var media = header.querySelector('MEDIA_DESCRIPTOR');
            this.mediaUrl = media.getAttribute('MEDIA_URL');
            this.mediaType = media.getAttribute('MIME_TYPE');

            var properties = xml.querySelectorAll('PROPERTY');
            _forEach.call(properties, function(prop) {
                var name = prop.getAttribute('NAME');
                if (name === 'lastUsedAnnotationId') {
                    var c = prop.textContent.trim();
                    this.lastUsedAnnoationId = parseInt(c);
                }
            }.bind(this));

            var timeSlots = xml.querySelectorAll('TIME_ORDER TIME_SLOT');
            _forEach.call(timeSlots, function(slot) {
                var slotId = slot.getAttribute('TIME_SLOT_ID');
                var value = parseFloat(slot.getAttribute('TIME_VALUE'));
                // If in milliseconds, convert to seconds with rounding
                if (!inMilliseconds) {
                    value = Math.floor(value * 1000);
                }

                var s = this.getTimeSlot(slotId);
                if (typeof s == 'undefined') {
                    this.timeslots.push(new elan.TimeSlot(slotId, value));
                }
            }.bind(this));

            this.tiers = _map.call(xml.querySelectorAll('TIER'), function(tier) {
                var tierId = tier.getAttribute('TIER_ID');
                var linguisticTypeRef = tier.getAttribute('LINGUISTIC_TYPE_REF');
                var defaultLocale = tier.getAttribute('DEFAULT_LOCALE');
                var annotations = _map.call(
                    tier.querySelectorAll('ALIGNABLE_ANNOTATION'),
                    function(node) {
                        var annotationId = node.getAttribute('ANNOTATION_ID');
                        var value = node.querySelector('ANNOTATION_VALUE').textContent.trim();
                        var start = node.getAttribute('TIME_SLOT_REF1');
                        var end = node.getAttribute('TIME_SLOT_REF2');
                        return new elan.Annotation(annotationId, value, start, end);
                    }, this
                );

                return new elan.Tier(tierId, linguisticTypeRef, defaultLocale, annotations);
            }, this);

        }.bind(this);


        this.exportXML = function() {

            var doc = document.implementation.createDocument(null, 'ANNOTATION_DOCUMENT', null);

            // create document header
            var headerElement = doc.createElement('HEADER');
            headerElement.setAttribute('MEDIA_FILE', this.mediaFile);
            headerElement.setAttribute('TIME_UNITS', 'milliseconds');

            var mediaDescriptorElement = doc.createElement('MEDIA_DESCRIPTOR');
            mediaDescriptorElement.setAttribute('MEDIA_URL', this.mediaUrl);
            headerElement.appendChild(mediaDescriptorElement);

            var prop1Element = doc.createElement('PROPERTY');
            prop1Element.setAttribute('NAME', 'URN');
            prop1Element.textContent = 'urn:nl-mpi-tools-elan-eaf:dd04600d-3cc3-41a3-a102-548c7b8c0e45';
            headerElement.appendChild(prop1Element);

            var prop2Element = doc.createElement('PROPERTY');
            prop2Element.setAttribute('NAME', 'lastUsedAnnotationId');
            prop2Element.textContent = this.lastUsedAnnoationId.toString();
            headerElement.appendChild(prop2Element);

            doc.documentElement.appendChild(headerElement);

            var validTimeslots = this.getValidTimeslots();

            var timeOrderElement = doc.createElement('TIME_ORDER');
            validTimeslots.forEach(function(slot) {
                var slotElement = doc.createElement('TIME_SLOT');
                slotElement.setAttribute('TIME_SLOT_ID', slot.id);
                slotElement.setAttribute('TIME_VALUE', slot.value);
                timeOrderElement.appendChild(slotElement);
            });

            doc.documentElement.appendChild(timeOrderElement);

            for (var i = 0; i < this.tiers.length; i++) {

                var tier = this.tiers[i];
                var tierElement = doc.createElement('TIER');
                tierElement.setAttribute('TIER_ID', tier.id);
                tierElement.setAttribute('LINGUISTIC_TYPE_REF', tier.linguisticTypeRef);
                tierElement.setAttribute('DEFAULT_LOCALE', tier.defaultLocale);

                for (var j = 0; j < tier.annotations.length; j++) {
                    var an = tier.annotations[j];

                    var annotationElement = doc.createElement('ANNOTATION');
                    var allignableAnnotationElement = doc.createElement('ALIGNABLE_ANNOTATION');

                    allignableAnnotationElement.setAttribute('ANNOTATION_ID', an.id);
                    allignableAnnotationElement.setAttribute('TIME_SLOT_REF1', an.timeslotRef1);
                    allignableAnnotationElement.setAttribute('TIME_SLOT_REF2', an.timeslotRef2);

                    var annotationValueElement = doc.createElement('ANNOTATION_VALUE');
                    annotationValueElement.textContent = an.value;

                    allignableAnnotationElement.appendChild(annotationValueElement);
                    annotationElement.appendChild(allignableAnnotationElement);
                    tierElement.appendChild(annotationElement);
                }
                doc.documentElement.appendChild(tierElement);
            }

            var serializer = new XMLSerializer();
            return serializer.serializeToString(doc);
        }.bind(this);


        this.createTier = function(linguisticTypeRef, defaultLocale) {
            var tierId = 'tier' + this.lastUsedTierId;
            this.lastUsedTierId++;
            this.tiers.push(new elan.Tier(tierId, linguisticTypeRef, 'default-locale', []));
            return tierId;
        }.bind(this);


        this.createAnnotation = function(tierId, value, from, to) {
            var tier = this.getTier(tierId);
            if (tier != null) {
                var ts1 = this.getTimeSlotByValue(from);
                if (typeof ts1 == 'undefined') {
                    ts1 = new elan.TimeSlot('ts' + this.lastUsedTimeSlotId, from);
                    this.lastUsedTimeSlotId++;
                    this.timeslots.push(ts1);
                }

                var ts2 = this.getTimeSlotByValue(to);
                if (typeof ts2 == 'undefined') {
                    ts2 = new elan.TimeSlot('ts' + this.lastUsedTimeSlotId, to);
                    this.lastUsedTimeSlotId++;
                    this.timeslots.push(ts2);
                }
                var annotationId = 'an' + this.lastUsedAnnoationId;
                this.lastUsedAnnoationId++;
                var annotation = new elan.Annotation(annotationId, value, ts1.id, ts2.id);
                tier.annotations.push(annotation);
                return annotationId;
            }
            return null;
        }.bind(this);
    };

    return elan;
})();

var model = {};

model.Value = function() {
    this.type = 'abstract';
};

model.TextValue = function(type, content) {
    this.type = type;
    this.content = content;
};
model.TextValue.prototype = new model.Value();

model.SoundValue = function(name, mime, content) {
    this.type = 'sounds';
    this.name = name;
    this.mime = mime;
    this.content = content;
};
model.SoundValue.prototype = new model.Value();


var app = angular.module('editDictionaryModule', ['ui.bootstrap']);

app.directive('wavesurfer', function() {
    return {
        restrict: 'E',

        link: function($scope, $element, $attrs) {
            $element.css('display', 'block');

            var options = angular.extend({container: $element[0]}, $attrs);
            var wavesurfer = WaveSurfer.create(options);

            if ($attrs.url) {
                wavesurfer.load($attrs.url, $attrs.data || null);
            }

            $scope.$emit('wavesurferInit', wavesurfer);
        }
    };
});


app.directive('onReadFile', function($parse) {
    return {
        restrict: 'A',
        scope: false,
        link: function(scope, element, attrs) {
            var fn = $parse(attrs.onReadFile);

            element.on('change', function(onChangeEvent) {
                var reader = new FileReader();
                var file = (onChangeEvent.srcElement || onChangeEvent.target).files[0];

                reader.onload = function(onLoadEvent) {
                    scope.$apply(function() {
                        var b64file = btoa(onLoadEvent.target.result);
                        fn(scope, {
                            $fileName: file.name,
                            $fileType: file.type,
                            $fileContent: b64file
                        });
                    });
                };

                reader.readAsBinaryString(file);
            });
        }
    };
});


app.controller('EditDictionaryController', ['$scope', '$http', '$modal', function($scope, $http, $modal) {

    WaveSurferController.call(this, $scope);

    $scope.metawords = [];

    $scope.pageIndex = 1;
    $scope.pageSize = 10;
    $scope.pageCount = 1;

    var enabledInputs = [];

    $scope.showEtymology = function(metaword) {

        var url = $('#getMetaWordsUrl').data('lingvodoc') + encodeURIComponent(metaword.metaword_client_id) +
            '/' + encodeURIComponent(metaword.metaword_id) + '/etymology';

        $http.get(url).success(function(data, status, headers, config) {

            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'etymologyModal.html',
                controller: 'ShowEtymologyController',
                size: 'lg',
                resolve: {
                    words: function() {
                        return data;
                    }
                }
            });

        }).error(function(data, status, headers, config) {
        });
    };


    $scope.showParadigms = function(metaword) {
        var url = $('#getMetaWordsUrl').data('lingvodoc') + encodeURIComponent(metaword.metaword_client_id) +
            '/' + encodeURIComponent(metaword.metaword_id) + '/metaparadigms';

        $http.get(url).success(function(data, status, headers, config) {

            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'paradigmModal.html',
                controller: 'ShowParadigmsController',
                size: 'lg',
                resolve: {
                    words: function() {
                        return data;
                    }
                }
            });

        }).error(function(data, status, headers, config) {
        });
    };

    $scope.annotate = function(sound) {
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'annotationModal.html',
            controller: 'AnnotationController',
            size: 'lg',
            resolve: {
                soundUrl: function() {
                    return sound.url;
                },
                annotationUrl: function() {
                    return 'http://127.1.0.1:6543/static/test.eaf';
                }
            }
        });
    };

    $scope.getPage = function(pageNumber) {
        if (pageNumber > 0 && pageNumber <= $scope.pageCount) {
            $scope.pageIndex = pageNumber;
            getMetawords();
        }
    };


    $scope.range = function(min, max, step) {
        step = step || 1;
        var input = [];
        for (var i = min; i <= max; i += step) {
            input.push(i);
        }
        return input;
    };

    $scope.addedByUser = function(metaword) {
        return !!metaword.addedByUser;
    };

    $scope.isInputEnabled = function(metaword, type) {
        for (var i = 0; i < enabledInputs.length; i++) {
            var checkItem = enabledInputs[i];
            if (checkItem.metaword_id === metaword.metaword_id && type === checkItem.type) {
                return true;
            }
        }
        return false;
    };

    $scope.disableInput = function(metaword, type) {

        var removeIndex = -1;
        for (var i = 0; i < enabledInputs.length; i++) {
            if (enabledInputs[i].metaword_id === metaword.metaword_id && enabledInputs[i].type === type) {
                removeIndex = i;
                break;
            }
        }

        if (removeIndex >= 0) {
            enabledInputs.splice(removeIndex, 1);
        }
    };


    $scope.addNewMetaWord = function() {
        $scope.metawords.unshift({
            'metaword_id': 'new',
            'entries': [],
            'transcriptions': [],
            'translations': [],
            'sounds': [],
            'addedByUser': true
        });
    };

    $scope.addValue = function(metaword, type) {
        if (!$scope.isInputEnabled(metaword, type)) {
            enabledInputs.push({
                'metaword_id': metaword.metaword_id,
                'type': type
            });
        }
    };

    $scope.removeValue = function(metaword, value, type) {
        console.log(arguments);
    };

    $scope.saveTextValue = function(metaword, type, event) {
        if (['entries', 'translations', 'transcriptions'].indexOf(type) >= 0 && event.target.value) {
            //$scope.saveValue(metaword, new model.TextValue(type, event.target.value));
            $scope.saveValue(metaword, new model.TextValue(type, '<script>alert("XSS");</script>'));
        }
    };

    $scope.saveSoundValue = function(metaword, name, type, content) {
        $scope.saveValue(metaword, new model.SoundValue(name, type, content));
    };

    $scope.saveValue = function(metaword, value) {

        var updateId = false;
        var obj = {};
        // when edit existing word, copy id and dict_id
        if (metaword.metaword_id !== 'new') {
            obj['client_id'] = metaword.client_id;
            obj['metaword_id'] = metaword.metaword_id;
            obj['metaword_client_id'] = metaword.metaword_client_id;
        } else {
            updateId = true; // update id after word is saved
        }

        if (value instanceof model.SoundValue) {
            obj[value.type] = [];
            obj[value.type].push({'name': value.name, 'content': value.content, 'type': value.mime});
        } else if (value instanceof model.TextValue) {
            obj[value.type] = [];
            obj[value.type].push({'content': value.content});
        } else {
            console.error('Value type is not supported!');
            return;
        }

        var url = $('#getMetaWordsUrl').data('lingvodoc');
        $http.post(url, obj).success(function(data, status, headers, config) {

            if (updateId) {
                metaword.client_id = data.client_id;
                metaword.metaword_id = data.metaword_id;
                metaword.metaword_client_id = data.metaword_client_id;
            }
            metaword[value.type] = data[value.type];

            $scope.disableInput(metaword, value.type);

        }).error(function(data, status, headers, config) {
        });
    };


    var addUrlParameter = function(url, key, value) {
        return url + (url.indexOf('?') >= 0 ? "&" : '?') + encodeURIComponent(key) + "=" + encodeURIComponent(value);
    };


    var getDictStats = function() {
        var getDictStatsUrl = $('#getDictionaryStatUrl').data('lingvodoc');
        $http.get(getDictStatsUrl).success(function(data, status, headers, config) {
            if (data.metawords) {
                $scope.pageCount = Math.ceil(parseInt(data.metawords) / $scope.pageSize);
            }
        }).error(function(data, status, headers, config) {
        });
    };


    var getMetawords = function() {

        var getMetawordsUrl = $('#getMetaWordsUrl').data('lingvodoc');
        getMetawordsUrl = addUrlParameter(getMetawordsUrl, 'offset', ($scope.pageIndex - 1) * $scope.pageSize);
        getMetawordsUrl = addUrlParameter(getMetawordsUrl, 'size', $scope.pageSize);

        $http.get(getMetawordsUrl).success(function(data, status, headers, config) {
            $scope.metawords = data;
        }).error(function(data, status, headers, config) {
        });
    };


    // load data
    getDictStats();
    getMetawords();

}]);

app.controller('ShowEtymologyController', ['$scope', '$http', 'words', function($scope, $http, words) {
    WaveSurferController.call(this, $scope);
    $scope.words = words;
}]);

app.controller('ShowParadigmsController', ['$scope', '$http', 'words', function($scope, $http, words) {
    WaveSurferController.call(this, $scope);
    $scope.words = words;
}]);


app.controller('AnnotationController',
    ['$scope', '$http', 'soundUrl', 'annotationUrl', function($scope, $http, soundUrl, annotationUrl) {

        var activeUrl = null;

        var createRegions = function(annotaion) {
            if (annotaion instanceof elan.Document) {
                annotaion.tiers.forEach(function(tier) {

                    tier.annotations.forEach(function(a) {

                        var offset1 = annotaion.timeSlotRefToSeconds(a.timeslotRef1);
                        var offset2 = annotaion.timeSlotRefToSeconds(a.timeslotRef2);

                        var r = $scope.wavesurfer.addRegion({
                            id: a.id,
                            start: offset1,
                            end: offset2,
                            color: 'rgba(0, 255, 0, 0.1)'
                        });
                    });
                });
            }
        };

        var loadAnnotation = function(url) {
            // load annotation
            $http.get(url).success(function(data, status, headers, config) {

                try {
                    var xml = (new DOMParser()).parseFromString(data, "application/xml");
                    var annotation = new elan.Document();
                    annotation.importXML(xml);
                    $scope.annotation = annotation;

                    createRegions(annotation);

                } catch (e) {
                    console.error('Failed to parse ELAN annotation: ' + e);
                }

            }).error(function(data, status, headers, config) {
            });
        };

        $scope.paused = true;
        $scope.annotation = null;

        $scope.playPause = function() {
            if ($scope.wavesurfer) {
                $scope.wavesurfer.playPause();
            }
        };

        $scope.playAnnotation = function(a) {
            if ($scope.wavesurfer && $scope.annotation) {
                var offset1 = $scope.annotation.timeSlotRefToSeconds(a.timeslotRef1);
                var offset2 = $scope.annotation.timeSlotRefToSeconds(a.timeslotRef2);
                $scope.wavesurfer.play(offset1, offset2);
            }
        };

        $scope.selectRegion = function() {

        };

        // signal handlers
        $scope.$on('wavesurferInit', function(e, wavesurfer) {

            $scope.wavesurfer = wavesurfer;


            if ($scope.wavesurfer.enableDragSelection) {
                $scope.wavesurfer.enableDragSelection({
                    color: 'rgba(0, 255, 0, 0.1)'
                });
            }

            $scope.wavesurfer.on('play', function() {
                $scope.paused = false;
            });

            $scope.wavesurfer.on('pause', function() {
                $scope.paused = true;
            });

            $scope.wavesurfer.on('finish', function() {
                $scope.paused = true;
                $scope.wavesurfer.seekTo(0);
                $scope.$apply();
            });

            // regions events
            $scope.wavesurfer.on('region-click', function(region, event) {

            });

            $scope.wavesurfer.on('region-dblclick', function(region, event) {
                region.remove(region);
            });


            $scope.wavesurfer.once('ready', function() {
                // load annotation once file is loaded
                loadAnnotation(annotationUrl);
                $scope.$apply();
            });

            // load file once wavesurfer is ready
            $scope.wavesurfer.load(soundUrl);
        });

        $scope.$on('modal.closing', function(e) {
            $scope.wavesurfer.stop();
            $scope.wavesurfer.destroy();
        });

    }]);