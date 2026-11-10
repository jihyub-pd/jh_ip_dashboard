import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
export async function makePdf(title:string,report:any,images:Uint8Array[],fontBytes:Uint8Array) {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});const charset=new Set(font.getCharacterSet());let page:any;let y=0;
 function next(){page=pdf.addPage([595,842]);y=793;page.drawText(String(pdf.getPageCount()),{x:550,y:22,size:8,font});}
 function text(value:string,size=10){
  for(const paragraph of String(value).split('\n')){
   let line='';
   for(const char of paragraph.replace(/[\u0000-\u0008\u000b-\u001f]/g,'')){
    const safe=charset.has(char.codePointAt(0)!)?char:' ';
    if(font.widthOfTextAtSize(line+safe,size)>499){draw(line,size);line=safe;}else line+=safe;
   }
   draw(line,size); y-=5;
  }
 }
 function draw(line:string,size:number){if(y<size+55)next();page.drawText(line,{x:48,y,size,font,color:rgb(.12,.17,.13)});y-=size*1.65;}
 next();text(title,22);
 const sections=[['로그라인','logline'],['작품 핵심 포인트','key_points'],['주요 인물','characters'],['간략 줄거리','synopsis'],['프리비주얼','images'],['수정 의견 및 반영 방법','changes'],['검증표','verification'],['검토 범위와 이번 선택','scope']];
 for(const [label,key] of sections){
  if(y<140||key==='images')next(); y-=12;text(label,16);
  if(key==='images'){
   for(let i=0;i<images.length;i++){const img=await pdf.embedPng(images[i]);const h=499*img.height/img.width;if(y<h+70)next();text(i===0?'주요 인물 / 각색 디자인 제안':'주요 공간 / 각색 디자인 제안',11);page.drawImage(img,{x:48,y:y-h,width:499,height:h});y-=h+20;}
  } else text(report[key]);
 }
 return await pdf.save();
}
