(function () {
  var dateDialog = document.getElementById('date-picker');
  var timeDialog = document.getElementById('time-picker');
  var dateInput = document.getElementById('date-input');
  var timeInput = document.getElementById('time-input');
  var dateTrigger = document.getElementById('date-trigger');
  var timeTrigger = document.getElementById('time-trigger');
  var month = document.getElementById('calendar-month');
  var year = document.getElementById('calendar-year');
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var shown = new Date(today.getFullYear(), today.getMonth(), 1);
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  for (var m = 0; m < 12; m++) {
    month.add(new Option(new Date(2026, m, 1).toLocaleDateString('fr-FR', {month:'long'}), m));
  }
  function renderCalendar() {
    year.replaceChildren();
    for (var y = today.getFullYear(); y <= Math.max(today.getFullYear()+5, shown.getFullYear()+1); y++) year.add(new Option(y, y));
    month.value = shown.getMonth(); year.value = shown.getFullYear();
    document.getElementById('month-prev').disabled = shown.getFullYear() === today.getFullYear() && shown.getMonth() === today.getMonth();
    var grid = document.getElementById('calendar-days'); grid.replaceChildren();
    var offset = (shown.getDay() + 6) % 7;
    for (var i = 0; i < offset; i++) grid.appendChild(document.createElement('span'));
    var count = new Date(shown.getFullYear(), shown.getMonth()+1, 0).getDate();
    for (var d = 1; d <= count; d++) {
      var day = new Date(shown.getFullYear(), shown.getMonth(), d);
      var button = document.createElement('button'); button.type='button'; button.textContent=d;
      button.dataset.date=iso(day); button.disabled=day < today;
      button.setAttribute('aria-label', day.toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'}));
      button.setAttribute('aria-pressed', String(iso(day)===dateInput.value));
      if (iso(day)===iso(today)) button.setAttribute('aria-current','date');
      button.addEventListener('click', function () {
        dateInput.value=this.dataset.date;
        dateTrigger.firstElementChild.textContent=new Date(dateInput.value+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
        checkS3(); dateDialog.close();
      }); grid.appendChild(button);
    }
  }
  dateTrigger.addEventListener('click',function(){ if(dateInput.value) { var selected=new Date(dateInput.value+'T12:00'); shown=new Date(selected.getFullYear(),selected.getMonth(),1); } renderCalendar(); dateDialog.showModal(); });
  function changeMonth(delta) { shown=new Date(shown.getFullYear(),shown.getMonth()+delta,1); renderCalendar(); }
  document.getElementById('month-prev').onclick=function(){changeMonth(-1);};
  document.getElementById('month-next').onclick=function(){changeMonth(1);};
  function selectMonth(){ shown=new Date(Number(year.value),Number(month.value),1); if(shown < new Date(today.getFullYear(),today.getMonth(),1)) shown=new Date(today.getFullYear(),today.getMonth(),1); renderCalendar(); }
  month.onchange=selectMonth; year.onchange=selectMonth;
  function chooseTime(value) { timeInput.value=value; timeTrigger.firstElementChild.textContent=value.replace(':','h'); checkS3(); timeDialog.close(); }
  var grid=document.getElementById('time-grid');
  for(var h=8;h<24;h++) for(var minute=0;minute<60;minute+=30){
    var button=document.createElement('button');button.type='button';
    button.dataset.time=String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0');
    button.textContent=h+'h'+String(minute).padStart(2,'0');
    button.onclick=function(){chooseTime(this.dataset.time);}; grid.appendChild(button);
  }
  timeTrigger.onclick=function(){ grid.querySelectorAll('button').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.time===timeInput.value));}); document.getElementById('precise-time').value=timeInput.value; timeDialog.showModal(); };
  document.getElementById('apply-time').onclick=function(){var input=document.getElementById('precise-time'); if(input.value) chooseTime(input.value); else input.focus();};
  [dateDialog,timeDialog].forEach(function(dialog){dialog.querySelector('[data-close]').onclick=function(){dialog.close();};dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
})();
