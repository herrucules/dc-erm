var interactiveApp = {
  appRoutes: appRoutes,
  audioHandles: {},
  videoHandle: null,
  quizes: [],
  currentRoute: null,
  preloadjs: null,
  scormLmsConnected: false,
  scormTimerHandle: null,
  timeline:null,
  menuBtn: $('#menu-icon'),
  menuContainer: $('#menu-container'),
};

var unloaded = false;
function OnUnload()
{
   if(unloaded == false)
   {
      pipwerks.SCORM.save();
      pipwerks.SCORM.quit();
      
      unloaded = true;
   }
}

$(function() {

  var preload = new createjs.LoadQueue(false);
  interactiveApp.preloadjs = preload;
  preload.on('complete', handlePreloadComplete);
  $('#content, #nav-next, #nav-prev, #menu-icon, #menu-container').hide();  

  function handlePreloadComplete () {
    clog('preload complete..');  
    $('#preloader').hide();
    $('#content, #menu-icon, #menu-container').show();
    initRouting();
    interactiveApp.initSCORM();
  }

  if (manifestToLoad == undefined) manifestToLoad = [];

  $.each(interactiveApp.appRoutes, function (index, value) {
    if (value.audioURL) {
      manifestToLoad.push({id: value.name, src: value.audioURL});
    }
  });
  if (manifestToLoad.length) {
    createjs.Sound.registerPlugins([createjs.HTMLAudioPlugin]);  // need this so it doesn't default to Web Audio
    preload.installPlugin(createjs.Sound);
    preload.loadManifest(manifestToLoad);    
  } else {
    handlePreloadComplete(); 
  }

  function handleLoadedAssets () {
    return;
    var imgs = $('#content img');
    $.each(imgs, function(index, value) {
      var obj = $(value);
      if (obj.data('preloaded') == '1') return;      
      var result;
      if (result = interactiveApp.preloadjs.getResult(obj.attr('src'),true)) {
        var img = $('<img>', {
            src: URL.createObjectURL(result),
            alt: obj.attr('alt')
          })
        obj.data('preloaded','1')
            .hide()
            .after(img);
      }
      // $.each(manifestToLoad, function (i, v) {
      //   if (obj.attr("src") == v.src) {          
      //     var newAsset = interactiveApp.preloadjs.getTag(v.id);
      //     obj.data('preloaded','1')
      //       .hide()
      //       .after(newAsset);
      //     console.log(interactiveApp.preloadjs.getTag(v.id));
      //     // newAsset.attr('alt', obj.attr('alt'));
      //   }
      // });
    });
  }

  function initRouting() {

    interactiveApp.mainSection = $('#interactive-container > #content');

    $.sammy(function() {

      var _this = this;      

      $.each(interactiveApp.appRoutes, function(index, value) {   
        _this.before(value.url, function() {
          for (var p in interactiveApp.audioHandles) {
            // console.log(p);
            interactiveApp.audioHandles[p].stop();
          }
        });

        _this.get(value.url, function() {   
          // console.log('get: '+value.url);
          $.get(value.templateUrl, function(d) {

            interactiveApp.setSCOLocation(value.url);

            var menus = interactiveApp.menuContainer.find('a');
            $.each(menus, function (i, menu) {
              menu = $(menu);              
              menu.routeID = interactiveApp.getRouteID(menu.attr('href'));
              if (menu.routeID <= parseInt(value.id)) {
                menu.removeClass();
              }
            });

            interactiveApp.currentRoute = value;

            function setContent() {

              $('#logo').show();

              // set the content
              interactiveApp
                .mainSection
                .html(d);    

              $('.tooltip').tooltipster({
                trigger:'click',
                theme: ['tooltipster-noir', 'tooltipster-noir-customized']
              });  

              handleLoadedAssets();

              initQuiz(value.id); 
              executeScript();    

              // $('#nav-next, #nav-prev').off('click');

              $('a').off('click');
              $('a').on('click', function(e) {
                e.stopPropagation();
                var source = $(this);
                var href = source.attr('href');
                if (href && /^#\//.test(href)) {
                  window.location = href;                  
                  href = href.substring(1);
                  for (var i=0; i<interactiveApp.appRoutes.length; i++) {
                    var route = interactiveApp.appRoutes[i];
                    if (href == route.url) {
                      if (route.audioURL) {
                        interactiveApp.playAudio(route.name);
                      }
                      break;
                    }
                  }
                } else if (source.attr('id') == 'nav-next' && index+1 < interactiveApp.appRoutes.length) {
                  window.location = '#'+interactiveApp.appRoutes[index+1].url;      
                  interactiveApp.playAudio(interactiveApp.appRoutes[index+1].name);
                } else if (source.attr('id') == 'nav-prev' && index-1 > -1) {
                  window.location = '#'+interactiveApp.appRoutes[index-1].url;      
                  interactiveApp.playAudio(interactiveApp.appRoutes[index-1].name);
                }

                return false;
              });

              if (value.hideNext) {
                $('#nav-next').hide();
              } else {
                $('#nav-next').show();
              }
              if (value.hidePrev) {
                $('#nav-prev').hide();
              } else {
                $('#nav-prev').show();
              }
              if (value.hideNext && value.hidePrev) {
                $('#nav-prev').parent().hide();
              } else {
                $('#nav-prev').parent().show();
              }

            //   $('#nav-next').on('click', function(e) {
            //     e.stopPropagation();
            //     // console.log(index);
            //     if (index+1 < interactiveApp.appRoutes.length) {
            //       window.location = '#'+interactiveApp.appRoutes[index+1].url;      
            //       interactiveApp.playAudio(interactiveApp.appRoutes[index+1].name);
            //     }

            //     return false;
            //   });

            //   $('#nav-prev').on('click', function(e) {
            //     e.stopPropagation();

            //     var href = $(this).attr('href');
            //     if (href) {
            //       window.location = href;                  
            //       href = href.substring(1);
            //       for (var i=0; i<interactiveApp.appRoutes.length; i++) {
            //         var route = interactiveApp.appRoutes[i];
            //         if (href == route.url) {
            //           if (route.audioURL) {
            //             interactiveApp.playAudio(route.name);
            //           }
            //           break;
            //         }
            //       }
            //     }
            //     else if (index-1 > -1) {
            //       window.location = '#'+interactiveApp.appRoutes[index-1].url;      
            //       interactiveApp.playAudio(interactiveApp.appRoutes[index-1].name);
            //     }
                

            //     return false;
            //   });

              if (value.postTracked == undefined || value.postTracked == false) {
                interactiveApp.LOProgress.set(value);            
              }
            }


            if (interactiveApp.outAnim) {
              interactiveApp.outAnim( setContent );
            }
            else {
              setContent();
            }
            
          })
        });      
      });

    }).run();

  }

  $('#interactive-container').on('click', '.action-resume-animation', function () {
    if (interactiveApp.timeline != null) {
      interactiveApp.timeline.resume();
    }
    $(this).off('click');
  });

  interactiveApp.menuContainer.css('top', '-200%');
  interactiveApp.menuBtn.on('click', function() {    
    var menu = interactiveApp.menuContainer;
    var btn = interactiveApp.menuBtn;
    if (btn.data('is-open')) {
      btn.data('is-open', false);
      TweenLite.to(menu, 2, {top: '-200%', ease:Expo.easeOut});      
    } else {
      clog('open dong..')
      btn.data('is-open', true);
      TweenLite.to(menu, .5, {top: 0, ease:Expo.easeOut});      
    }

    var icon = btn.children('img');
    var tmp = icon.data('alt-img');
    icon.data('alt-img', icon.attr('src'));
    icon.attr('src', tmp);
  });
  interactiveApp.menuContainer.on('click', 'a', function (e) {    
    e.stopPropagation();
    var $this = $(this);
    console.log($this.hasClass('disabled'));
    if ($this.hasClass('disabled')) 
      return false;
    
    interactiveApp.linkChange( $this.attr('href') );    
  });

});

interactiveApp.linkChange = function (href) {
  window.location = href;                  
  href = href.substring(1);
  for (var i=0; i<interactiveApp.appRoutes.length; i++) {
    var route = interactiveApp.appRoutes[i];
    if (href == route.url) {
      if (route.audioURL) {
        interactiveApp.playAudio(route.name);
      }
      break;
    }
  }
};

interactiveApp.initSCORM = function() {     
  var self = this;
  
  self.scormLmsConnected = pipwerks.SCORM.init();

  //flagLocations("0|0,0|0,0|0~opening_1,tujuan_0,menu_0,pembinaan_0,hubungan-kerja_0,resiko_0,assessment_0~0|0|0|0~0|0");
  
  if(self.scormLmsConnected)
  {       
    self.scormLessonStatus = pipwerks.SCORM.data.get("cmi.core.lesson_status");
    
    if(self.scormLessonStatus == "completed" || self.scormLessonStatus == "passed" || self.scormLessonStatus == "failed"){
      
      //Course has already been completed.
      
      //_scorm.disconnect();
      
    } else {
      
      self.scormLessonLocation = pipwerks.SCORM.data.get("cmi.core.lesson_location"); 
      var href = '#/';
      if (self.scormLessonLocation != "") {
        href = '#'+self.scormLessonLocation;
      }
      window.location = href;     
      
      var rData = pipwerks.SCORM.data.get("cmi.suspend_data");
      self._scormSuspendData = [];          
      if(rData != "")
      {           
        // flagLocations(rData);
      }
                
      interactiveApp.initSCORMTimer();
                        
      if(self.scormLessonStatus == "not attempted" || self.scormLessonStatus == "") 
        _scormSuccess = pipwerks.SCORM.data.set("cmi.core.lesson_status", "not attempted");
      else
        _scormSuccess = pipwerks.SCORM.data.set("cmi.core.lesson_status", "incomplete");
    }
    
  } else {
    
    clog("Could not connect to LMS.");
    
  }
  
};

interactiveApp.setSCOLocation = function (value) {
  if (!interactiveApp.scormLmsConnected) return;

  pipwerks.SCORM.data.set('cmi.core.lesson_location', value);
  if(!pipwerks.SCORM.data.save()) {
    clog("API: data failed to be set");
  }              
};

interactiveApp.initSCORMTimer = function () {
  clearInterval(self.scormTimerHandle);
  var intervalCount = 0;
  self.scormTimerHandle = setInterval(function(){   

    clog (pipwerks.SCORM.data.set("cmi.core.session_time",
      interactiveApp.formatTimeSCORM(++intervalCount)));

    // if(!pipwerks.SCORM.data.save()) {
    //   clog("API: data failed to be set");
    // } 

  }, 1000);
};

interactiveApp.formatTimeSCORM = function(time) {   
  var strTime = "";
  var second = time%60;
  var minute = Math.floor(time/60)%60;
  var hour = Math.floor(time/3600);
  
  if (hour<10) 
    strTime += "0"+hour+":";      
  else
    strTime += hour+":";
  
  if (minute<10) 
    strTime += "0"+minute+":";
  else
    strTime += minute+":";
  
  if (second<10) 
    strTime += "0"+second+".00";
  else
    strTime += second+".00";
  
  // console.log(strTime);
  return strTime;
};

interactiveApp.LOProgress = {
  init: function() {
    var self = this;
    self.totalProgressEl = $('#total-progress');
    self.totalProgress = 0;
    self.visitedSection = [];
  },
  set: function(section) {
    var self = this;
    if (self.visitedSection.indexOf(section) == -1 && section.tracked != undefined) {
      self.totalProgress += section.tracked;
      //self.totalProgressEl.css('width', self.totalProgress+'%');
      self.visitedSection.push(section);
    }
  }
};
interactiveApp.LOProgress.init();

interactiveApp.playAudio = function (id) {
  // if (interactiveApp.audioHandles[id]) {
    interactiveApp.audioHandles[id] = createjs.Sound.play(id);
  // }
};

interactiveApp.getRouteID = function (url) {  
  for (var i=0; i<appRoutes.length; i++) {
    if ('#'+appRoutes[i].url == url) {
      return parseInt(appRoutes[i].id);
    }
  }
  return false;
};

$(window).TabWindowVisibilityManager({
    onFocusCallback: function(){
        for (var p in interactiveApp.audioHandles) {
          interactiveApp.audioHandles[p].paused = false;
        }
        if (interactiveApp.videoHandle) {
          interactiveApp.videoHandle.play();
        }
    },
    onBlurCallback: function(){
        for (var p in interactiveApp.audioHandles) {
          interactiveApp.audioHandles[p].paused = true;
        }
        if (interactiveApp.videoHandle) {
          interactiveApp.videoHandle.pause();
        }
    }
});


// window resized
  var ic, w, h;

  ic = $('#interactive-container');
  w = ic.width();
  h = ic.height();


  $(window).resize(resizeme);
  function resizeme() {    
    var win = $(window),
        windowHeight = win.height(),
        windowWidth = win.width(),
        proportion = {w:5, h:3},
        ratio = proportion.w / proportion.h;

    var currentRatio = windowWidth/windowHeight;

    if (currentRatio > ratio) {
      // wider
      h = windowHeight;
      w = h * ratio;
      ic.css({height:h, width:w});
    } else if (currentRatio < ratio) {
      // higher
      w = windowWidth;
      h = w * proportion.h / proportion.w;
      ic.css({height: h, width: w});      
    }
  }
  resizeme();
  ic.flowtype({
    fontRatio : 45
  });  

    // interact('#interactive-container .moveable')
    //  .draggable({
    //     onmove: calcPercentPos
    //   })
    //  .resizable({
    //   edges:{right:true, bottom:true}
    //   })
    //  .on('resizemove', calcPercentSize);

var selectedEl = {}, deselect = false;
$(document).ready(function() {
  ic.on('click', '.moveable', function() {
    var obj = $(this);
    if (obj.hasClass('selected')) {
        obj.removeClass('selected');
        delete selectedEl[obj.attr('id')];        
    } else {
      obj.addClass('selected');
      selectedEl[obj.attr('id')] = obj;
    }
  });
});

function alignTop () {
  var top = h;
  $.each(selectedEl, function(i, obj) {
    var objTop = obj.position().top;
    if (objTop < top) top = objTop;
  });
  $.each(selectedEl, function(i, obj) {
    var hp = obj.parent().height();
    obj.css({top:top/hp * 100 + '%'});    
  });
}

function alignLeft () {
  var left = w;
  $.each(selectedEl, function(i, obj) {
    var objLeft = obj.position().left;
    if (objLeft < left) left = objLeft;
  });
  $.each(selectedEl, function(i, obj) {
    var wp = obj.parent().width();
    obj.css({left:left/wp * 100 + '%'});    
  });
}

function alignRight () {
  var widest = 0;
  $.each(selectedEl, function(i, obj) {
    var objWide = obj.position().left + obj.width();
    if (objWide > widest) widest = objWide;
  });
  $.each(selectedEl, function(i, obj) {
    var wp = obj.parent().width();    
    obj.css({left:(widest - obj.width())/wp * 100 + '%'});    
  });
}

function alignBottom () {
  var highest = 0;
  $.each(selectedEl, function(i, obj) {
    var objHeight = obj.position().top + obj.height();
    if (objHeight > highest) highest = objHeight;
  });
  $.each(selectedEl, function(i, obj) {
    var hp = obj.parent().height();    
    obj.css({top:(highest - obj.height())/hp * 100 + '%'});    
  });
}

// Description:
//    Returns a random, alphanumeric string
//
// Arguments:
//    Length (Integer): Length of string to be generated. Defaults to random
//    integer.
//
// Returns:
//    Rand (String): Pseudo-random, alphanumeric string.
var ridx = 0;
function random_str () {
  var prefix = '';
  prefix = prefix || [('group'), (+new Date).toString(36)].join('-');

  return this.prefix + (this.ridx++).toString(36);
}

  function calcPercentPos(evt) {    
    var obj = $(evt.target),
        pos = obj.position(),
        x = pos.left + evt.dx,
        y = pos.top + evt.dy;

    var parent = obj.parent(),
        wp = parent.width(),
        hp = parent.height();


    $(obj).css({
      left: x / wp * 100 + "%",
      top: y / hp * 100 + "%"
    });

    // $(obj).css({
    //   left: x / wp * 100 + "%"
    // });
  };

  function calcPercentSize(evt) {    
    var obj = $(evt.target),
        parent = obj.parent(),
        wp = parent.width(),
        hp = parent.height(),
        minWidth = minHeight = 3, //percent
        width = evt.rect.width/wp * 100,
        height = evt.rect.height/hp * 100;

    width = width < minWidth ? minWidth : width;
    height = height < minHeight ? minHeight : height;
    $(obj).css({
      width: width+"%",
      height: height+"%"
    });
  };

function clog (str) {
  console.log(str);
}

var quizes;
function executeScript() {
  // prepare new quizdata container
  quizes = new Array(); 
  // remove the contenteditable
  $('[contenteditable]').removeAttr('contenteditable');
  // execute the scripts
   $('.script').each (function(i, el) {
      el = $(el);
      var scriptText = el.text();
      if (scriptText) {
        el.hide();
        try {
          var scriptVar = eval(scriptText);      
          if (scriptVar.quizType != undefined) {
            // it is a quiz!
            quizes.push(scriptVar);
          }
        }catch (ex) {}        
      }
    }); // end each   
}; // end executeScript

var currentQuizGroup, currentPageID;
function initQuiz (pageID) {
  currentPageID = pageID;
  initQuizMC();
  initQuizBtns();
  initQuizResponse();
}

function initQuizBtns () {
  // $('.quiz-next-btn').hide();

  $('#quiz-submit-btn').on('click', function() {
    var $submitBtn = $(this);
    // $('.quiz .alert-box').hide();  

    if (quizes) {
      var allCorrect = true, 
          reachMaxTry = false;

      $.each (quizes, function (i, quiz) {
        var quizID = quiz.id;
        var status = 'incorrect';
        currentQuizGroup = quizGroup[quiz.group];

        if (currentQuizGroup.maxTry > 0) 
          quiz.tries = parseInt(quiz.tries) + 1;        

        var result = true;
        switch (quiz.quizType) {
          case 'mc':
          case 'tf':
            var answer = quiz.answer;              
            var userAnswer = $('input[name='+quizID+']:checked').val();
            quiz.userAnswer = userAnswer;
            if ( answer != userAnswer ) {
              result = false;                
            } 
          break;

          // case 'sa':
          //   $.each (quiz.answer, function (key, val) {
          //     var answers = val.split('#');
          //     $.each (answers, function (i, answer) {
          //       answers[i] = answer.trim();
          //     });
          //     var userAnswer = $('#'+key).val().trim();
          //     if ( answers.indexOf(userAnswer) == -1) {
          //       result = false;
          //       return false;
          //     }                
          //   });
          // break;

          // case 'dd':
          //   $.each (quiz.answer, function (key, val) {
          //     var answer = val;              
          //     var userAnswer = $('#'+key).val();
          //     if ( answer != userAnswer ) {
          //       result = false;
          //       return false;
          //     }                
          //   });
          // break;

          // case 'matching':
          //   result = checkQuizMatching();
          // break;
        }

        quiz.result = result;
        
        // mark result in group..
        $.each (currentQuizGroup.quizes, function (i, q) {
          if (q.page == currentPageID && q.quizID == quizID) {
            q.result = result;
            q.userAnswer = quiz.userAnswer;
            return false; // found - stop searching
          }
        });

        if (result) {
          status = 'correct';             
        } else {          
          if (currentQuizGroup.maxTry != 0 && quiz.tries >= currentQuizGroup.maxTry) {
            reachMaxTry = true;
            status = 'correction';
          } else {
            allCorrect = false;
            status = 'incorrect';
          }  
        }        

        $('#'+quizID+'-'+status).fadeIn();              
        clog(status);
        $(document).trigger('quiz/checked', {quizID:quizID, quizGroup:quiz.group, quizType:quiz.quizType, status:status});

      }); // end each quiz in this page!

      if (allCorrect || reachMaxTry) {
        $('.quiz-next-btn').show();
        $submitBtn.hide();

        checkAllQuestionInGroupAnswered();

      } // end if
    }
  }); // end on click submit

}

function checkAllQuestionInGroupAnswered () {
  // are all the questions answered in the group?
  var allAnswered = true;
  var totalCorrect = 0;
  $.each (currentQuizGroup.quizes, function (i, q) {
    if (q.result == undefined) {
      allAnswered = false;      
    } else if (q.result) {
      totalCorrect++;
    } 
  }); // end each

  clog('benar = '+totalCorrect+' dari '+currentQuizGroup.quizes.length);

  if (allAnswered) {
    clog('semua udah');
    var modal = $('.modal-catel');

    if (modal.length) {
      var htmlEl = modal.children(':not(.close-reveal-modal)');
      var htmlStr = htmlEl.html();
      htmlStr = htmlStr.replace('{correct}', totalCorrect);
      htmlStr = htmlStr.replace('{total}', currentQuizGroup.quizes.length);
      htmlEl.replaceWith(htmlStr);
          }

    $.each(appRoutes, function (i, el) {
      if (el.id == currentPageID) {        
        interactiveApp.LOProgress.set(el);
        return false;
      }
    });

  } else {
    clog('msi ad belum ');    
  }
}

function initQuizResponse () {
  $('.quiz-response').hide();
}

function initQuizMC () {
  $('.quiz-input-radio').each(function (i, el) {
    $(el).prop('checked', false);
  }); 
}