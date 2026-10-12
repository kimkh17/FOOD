(() => {
  const $ = (id) => document.getElementById(id);
  const today = new Date();
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dateFromISO = (s) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
  const escapeHTML = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selectedDate = toISO(today), shownMonth = new Date(today.getFullYear(),today.getMonth(),1);
  let currentRating = 0, reviews = [], currentUser = null, db = null, unsubscribe = null, toastTimer = null;
  const replyUnsubscribes = new Map();
  const configured = window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey && !window.FIREBASE_CONFIG.apiKey.startsWith('여기에_') &&
    window.FIREBASE_CONFIG.projectId && !window.FIREBASE_CONFIG.projectId.startsWith('여기에_');

  function showToast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800); }
  function setMessage(message,error=false){ $('formMessage').textContent=message; $('formMessage').classList.toggle('error',error); }
  function ratingText(n){ return n===0?'선택 안 함':`${n} / 10점`; }
  function starString(stars){
    let out='';
    for(let i=1;i<=5;i++){
      if(stars>=i) out+='<span class="star-icon full" aria-hidden="true">★</span>';
      else if(stars>=i-.5) out+='<span class="star-icon half" aria-hidden="true"><span class="star-empty">☆</span><span class="star-filled">★</span></span>';
      else out+='<span class="star-icon empty" aria-hidden="true">☆</span>';
    }
    return `<span class="star-row">${out}</span>`;
  }
  function renderRatingPicker(){
    const root=$('ratingPicker'); root.innerHTML='';
    const stars=document.createElement('div'); stars.className='interactive-stars';
    stars.setAttribute('role','group'); stars.setAttribute('aria-label','별을 눌러 0점부터 10점까지 선택');
    for(let i=1;i<=5;i++){
      const wrap=document.createElement('span'); wrap.className='interactive-star-wrap';
      const display=document.createElement('span'); display.className='interactive-star-display';
      display.innerHTML=starString(currentRating/2).replace('star-row','star-row picker-star-row');
      wrap.appendChild(display);
      const left=document.createElement('button'); left.type='button'; left.className='star-hit star-hit-left';
      left.setAttribute('aria-label',`${i-0.5}점 / 10점`); left.setAttribute('title',`${i-0.5}점`);
      left.addEventListener('click',()=>{currentRating=i*2-1;renderRatingPicker();$('ratingValue').textContent=ratingText(currentRating);});
      const right=document.createElement('button'); right.type='button'; right.className='star-hit star-hit-right';
      right.setAttribute('aria-label',`${i}점 / 10점`); right.setAttribute('title',`${i}점`);
      right.addEventListener('click',()=>{currentRating=i*2;renderRatingPicker();$('ratingValue').textContent=ratingText(currentRating);});
      wrap.append(left,right); stars.appendChild(wrap);
    }
    root.appendChild(stars);
    const clear=document.createElement('button'); clear.type='button'; clear.className='rating-clear'+(currentRating===0?' active':'');
    clear.textContent='별점 없음'; clear.setAttribute('aria-pressed',String(currentRating===0));
    clear.addEventListener('click',()=>{currentRating=0;renderRatingPicker();$('ratingValue').textContent=ratingText(0);});
    root.appendChild(clear);
    $('ratingValue').textContent=ratingText(currentRating);
  }
  function renderCalendar(){
    $('monthLabel').textContent=`${shownMonth.getFullYear()}년 ${shownMonth.getMonth()+1}월`;
    const root=$('calendarGrid'); root.innerHTML='';
    const first=new Date(shownMonth.getFullYear(),shownMonth.getMonth(),1), start=new Date(first); start.setDate(1-first.getDay());
    const last=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+1,0);
    const total=Math.ceil((first.getDay()+last.getDate())/7)*7;
    const datesWithReviews=new Set(reviews.map(r=>r.date));
    for(let i=0;i<total;i++){
      const d=new Date(start); d.setDate(start.getDate()+i); const iso=toISO(d);
      const btn=document.createElement('button'); btn.type='button'; btn.className='calendar-day';
      if(d.getMonth()!==shownMonth.getMonth())btn.classList.add('other-month');
      if(iso===toISO(today))btn.classList.add('today');
      if(iso===selectedDate)btn.classList.add('selected');
      btn.innerHTML=`<span class="day-number">${d.getDate()}</span>${datesWithReviews.has(iso)?'<span class="review-indicator"></span>':'<span style="height:5px"></span>'}`;
      btn.setAttribute('aria-label',`${iso}${datesWithReviews.has(iso)?', 리뷰 있음':''}`);
      btn.addEventListener('click',()=>{selectedDate=iso;shownMonth=new Date(d.getFullYear(),d.getMonth(),1);$('reviewDate').value=iso;renderCalendar();renderReviews();});
      root.appendChild(btn);
    }
  }
  function renderReviews(){
    const dayReviews=reviews.filter(r=>r.date===selectedDate).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const d=dateFromISO(selectedDate);
    $('selectedDateTitle').textContent=`${d.getMonth()+1}월 ${d.getDate()}일의 음식`;
    $('daySummary').textContent=dayReviews.length?`이 날 기록한 음식 ${dayReviews.length}개`:'';
    const root=$('reviewsList');
    // 날짜 변경 시 화면에서 사라진 리뷰의 답변 구독을 정리합니다.
    const visibleIds=new Set(dayReviews.map(r=>r.id));
    for(const [id,unsub] of replyUnsubscribes){ if(!visibleIds.has(id)){unsub();replyUnsubscribes.delete(id);} }
    if(!dayReviews.length){root.innerHTML='<div class="empty-state"><span class="empty-emoji">🍜</span><strong>아직 기록이 없어요</strong><p>이 날 먹은 음식을 첫 번째로 기록해 보세요.</p></div>';return;}
    root.innerHTML=dayReviews.map(r=>{
      const rating=Number(r.rating)||0, own=currentUser&&r.ownerUid===currentUser.uid;
      return `<article class="review-card" data-review-card="${escapeHTML(r.id)}">
        <div class="review-card-top"><div><h3 class="food-title">${escapeHTML(r.foodName)}</h3><div class="review-author">${escapeHTML(r.nickname||'익명')} · ${escapeHTML(r.date)}</div></div>
        <div class="review-stars" aria-label="${rating}점 / 10점">${rating?`${starString(rating/2)}<span class="review-rating-number">${rating}/10</span>`:'<span class="review-rating-number">평점 없음</span>'}</div></div>
        ${r.reviewText?`<p class="review-text">${escapeHTML(r.reviewText)}</p>`:''}
        ${r.cookNote?`<div class="cook-note"><strong>👩‍🍳 요리한 사람의 한마디</strong><p>${escapeHTML(r.cookNote)}</p></div>`:''}
        ${own?`<div class="review-actions"><button class="text-button" data-edit="${escapeHTML(r.id)}">수정</button><button class="text-button" data-delete="${escapeHTML(r.id)}">삭제</button></div>`:''}
        <div class="replies-area"><div class="replies-title">💬 답변 <span class="reply-count" data-reply-count="${escapeHTML(r.id)}">불러오는 중…</span></div>
          <div class="reply-list" data-reply-list="${escapeHTML(r.id)}"></div>
          <form class="reply-form" data-reply-form="${escapeHTML(r.id)}"><input type="text" maxlength="24" name="replyNickname" placeholder="이름" aria-label="답변 작성자 이름" required><input type="text" maxlength="500" name="replyText" placeholder="리뷰에 답변을 남겨 보세요…" aria-label="답변 내용" required><button type="submit" class="secondary-button">답변</button></form>
        </div>
      </article>`;
    }).join('');
    root.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editReview(b.dataset.edit)));
    root.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteReview(b.dataset.delete)));
    root.querySelectorAll('[data-reply-form]').forEach(form=>form.addEventListener('submit',submitReply));
    dayReviews.forEach(r=>watchReplies(r.id));
  }
  function watchReplies(reviewId){
    if(!db || replyUnsubscribes.has(reviewId)) return;
    const unsub=db.collection('foodReplies').where('reviewId','==',reviewId).onSnapshot(snapshot=>{
      const card=document.querySelector(`[data-review-card="${CSS.escape(reviewId)}"]`); if(!card)return;
      const list=card.querySelector('[data-reply-list]'), count=card.querySelector('[data-reply-count]');
      const replies=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      count.textContent=`${replies.length}개`;
      list.innerHTML=replies.length?replies.map(reply=>`<div class="reply-item"><div><strong>${escapeHTML(reply.nickname||'익명')}</strong><span class="reply-time">${new Date(reply.createdAt||Date.now()).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div><p>${escapeHTML(reply.text)}</p>${currentUser&&reply.ownerUid===currentUser.uid?`<button class="text-button" data-delete-reply="${escapeHTML(reply.id)}">내 답변 삭제</button>`:''}</div>`).join(''):'<p class="no-replies">아직 답변이 없어요. 첫 답변을 남겨 보세요.</p>';
      list.querySelectorAll('[data-delete-reply]').forEach(btn=>btn.addEventListener('click',()=>deleteReply(btn.dataset.deleteReply)));
    },err=>{console.error(err);const card=document.querySelector(`[data-review-card="${CSS.escape(reviewId)}"]`);if(card)card.querySelector('[data-reply-count]').textContent='불러오기 실패';});
    replyUnsubscribes.set(reviewId,unsub);
  }
  async function submitReply(e){
    e.preventDefault(); if(!db||!currentUser){showToast('Firebase 연결을 확인해 주세요.');return;}
    const form=e.currentTarget, reviewId=form.dataset.replyForm, nickname=form.elements.replyNickname.value.trim(), text=form.elements.replyText.value.trim();
    if(!nickname||!text)return;
    const button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{await db.collection('foodReplies').add({reviewId,nickname,text,ownerUid:currentUser.uid,createdAt:Date.now()});form.elements.replyText.value='';showToast('답변을 등록했어요.');}
    catch(err){console.error(err);showToast('답변을 저장하지 못했어요. Firestore 규칙을 확인해 주세요.');}
    finally{button.disabled=false;}
  }
  async function deleteReply(id){
    if(!confirm('이 답변을 삭제할까요?'))return;
    try{await db.collection('foodReplies').doc(id).delete();showToast('답변을 삭제했어요.');}
    catch(err){console.error(err);showToast('답변을 삭제하지 못했어요.');}
  }
  function resetForm(){
    $('reviewForm').reset(); $('reviewId').value=''; $('reviewDate').value=selectedDate;
    $('formTitle').textContent='음식 리뷰 쓰기'; $('submitReview').textContent='리뷰 저장하기';
    $('cancelEdit').classList.add('hidden'); currentRating=0;renderRatingPicker();setMessage('');
  }
  function editReview(id){
    const r=reviews.find(x=>x.id===id);if(!r)return;
    $('reviewId').value=r.id;$('reviewDate').value=r.date;$('nickname').value=r.nickname||'';
    $('foodName').value=r.foodName;$('reviewText').value=r.reviewText||'';$('cookNote').value=r.cookNote||'';
    currentRating=Number(r.rating)||0;renderRatingPicker();$('formTitle').textContent='리뷰 수정하기';
    $('submitReview').textContent='수정 내용 저장';$('cancelEdit').classList.remove('hidden');
    $('formPanel').scrollIntoView({behavior:'smooth',block:'start'});setMessage('수정 후 저장을 눌러 주세요.');
  }
  async function deleteReview(id){
    const r=reviews.find(x=>x.id===id);if(!r)return;
    if(!confirm(`"${r.foodName}" 리뷰를 삭제할까요?`))return;
    try{await db.collection('foodReviews').doc(id).delete();showToast('리뷰를 삭제했어요.');}
    catch(e){console.error(e);showToast('삭제하지 못했어요. 본인이 작성한 리뷰인지 확인해 주세요.');}
  }
  function connect(){
    if(!configured){
      $('reviewsList').innerHTML='<div class="empty-state"><span class="empty-emoji">🔧</span><strong>Firebase 설정이 필요해요</strong><p>config.js에 Firebase 웹 앱 설정을 입력하고 다시 열어 주세요. 설정 방법은 README.md를 확인해 주세요.</p></div>';
      $('daySummary').textContent='데이터베이스 연결 전';$('submitReview').disabled=true;$('submitReview').style.opacity='.55';return;
    }
    try{
      firebase.initializeApp(window.FIREBASE_CONFIG); const auth=firebase.auth(); db=firebase.firestore();
      auth.signInAnonymously().catch(e=>{console.error(e);showToast('로그인 연결 실패: Firebase 익명 로그인을 켜 주세요.');});
      auth.onAuthStateChanged(user=>{
        if(!user)return;currentUser=user;
        if(unsubscribe)unsubscribe();
        unsubscribe=db.collection('foodReviews').onSnapshot(snapshot=>{
          reviews=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
          renderCalendar();renderReviews();
        },err=>{console.error(err);$('reviewsList').innerHTML='<div class="empty-state"><strong>기록을 불러오지 못했어요.</strong><p>Firestore 보안 규칙과 데이터베이스 설정을 확인해 주세요.</p></div>';});
        $('submitReview').disabled=false;$('submitReview').style.opacity='1';
      });
    }catch(e){console.error(e);showToast('Firebase 설정을 확인해 주세요.');}
  }
  $('reviewDate').value=selectedDate;renderRatingPicker();renderCalendar();renderReviews();
  $('prevMonth').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()-1,1);renderCalendar();});
  $('nextMonth').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+1,1);renderCalendar();});
  $('addReviewTop').addEventListener('click',()=>{$('reviewDate').value=selectedDate;$('formPanel').scrollIntoView({behavior:'smooth',block:'start'});$('foodName').focus({preventScroll:true});});
  $('cancelEdit').addEventListener('click',resetForm);
  $('reviewForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!db||!currentUser){setMessage('먼저 Firebase 설정을 완료해 주세요.',true);return;}
    const id=$('reviewId').value;
    const payload={date:$('reviewDate').value,nickname:$('nickname').value.trim(),foodName:$('foodName').value.trim(),rating:currentRating,reviewText:$('reviewText').value.trim(),cookNote:$('cookNote').value.trim(),updatedAt:Date.now()};
    if(!payload.date||!payload.nickname||!payload.foodName){setMessage('날짜, 작성자 이름, 음식 이름을 입력해 주세요.',true);return;}
    if(payload.foodName.length>70||payload.reviewText.length>1500||payload.cookNote.length>700){setMessage('입력한 내용이 너무 길어요.',true);return;}
    $('submitReview').disabled=true;
    try{
      if(id){
        const existing=reviews.find(r=>r.id===id);
        if(!existing||existing.ownerUid!==currentUser.uid)throw new Error('본인이 작성한 리뷰만 수정할 수 있어요.');
        await db.collection('foodReviews').doc(id).update(payload);
      }else{
        await db.collection('foodReviews').add({...payload,ownerUid:currentUser.uid,createdAt:Date.now()});
      }
      selectedDate=payload.date;shownMonth=new Date(dateFromISO(payload.date).getFullYear(),dateFromISO(payload.date).getMonth(),1);
      renderCalendar();renderReviews();resetForm();showToast(id?'리뷰를 수정했어요.':'리뷰를 기록했어요.');
    }catch(err){console.error(err);setMessage(err.message||'저장에 실패했어요. 설정과 인터넷 연결을 확인해 주세요.',true);}
    finally{$('submitReview').disabled=false;}
  });
  connect();
})();
