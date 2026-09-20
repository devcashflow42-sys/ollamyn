/* ============================================================================
   ollamyn · renderizador de Markdown SEGURO (sin dependencias)
   Construye nodos del DOM con createElement/textContent — nunca innerHTML con
   el texto de la IA — por lo que es inmune a XSS. Los enlaces se limitan a
   http/https/mailto. Cubre lo típico de una respuesta de IA:
   encabezados, negrita, cursiva, código en línea, bloques ``` ```, listas,
   citas, enlaces, líneas horizontales y párrafos.
   ============================================================================ */
(function () {
  'use strict';

  function safeUrl(u) {
    var url = (u || '').trim();
    return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
  }

  // Formato en línea dentro de un bloque de texto.
  function inline(text, parent) {
    // 1: código `..`  | 3-4: negrita **..**  | 5-6: cursiva *..*  | 7-8: enlace [t](u)
    var re = /(`+)([\s\S]*?)\1|(\*\*)([\s\S]+?)\*\*|(\*)([^\s*][\s\S]*?)\*|\[([^\]]*)\]\(([^)\s]+)\)/;
    var rest = String(text);
    var m;
    var guard = 0;
    while ((m = re.exec(rest)) && guard++ < 20000) {
      if (m.index) parent.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (m[1] !== undefined && m[1] !== '') {
        var code = document.createElement('code');
        code.textContent = m[2];
        parent.appendChild(code);
      } else if (m[3] !== undefined) {
        var strong = document.createElement('strong');
        inline(m[4], strong);
        parent.appendChild(strong);
      } else if (m[5] !== undefined) {
        var em = document.createElement('em');
        inline(m[6], em);
        parent.appendChild(em);
      } else if (m[7] !== undefined) {
        var url = safeUrl(m[8]);
        if (url) {
          var a = document.createElement('a');
          a.textContent = m[7];
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer nofollow';
          parent.appendChild(a);
        } else {
          parent.appendChild(document.createTextNode(m[0]));
        }
      }
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) parent.appendChild(document.createTextNode(rest));
  }

  var RE_FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
  var RE_HEADING = /^(#{1,6})\s+(.*)$/;
  var RE_HR = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
  var RE_QUOTE = /^\s*>/;
  var RE_UL = /^\s*[-*+]\s+/;
  var RE_OL = /^\s*\d+[.)]\s+/;

  function isBlockStart(line) {
    return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_QUOTE.test(line) ||
      RE_UL.test(line) || RE_OL.test(line);
  }

  function render(md) {
    var frag = document.createDocumentFragment();
    var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // Bloque de código ``` ```
      var fence = RE_FENCE.exec(line);
      if (fence) {
        var ch = fence[1].charAt(0);
        var len = fence[1].length;
        var lang = fence[2].trim();
        i++;
        var buf = [];
        var closer = new RegExp('^\\s*\\' + ch + '{' + len + ',}\\s*$');
        while (i < lines.length && !closer.test(lines[i])) { buf.push(lines[i]); i++; }
        if (i < lines.length) i++; // salta el cierre
        var pre = document.createElement('pre');
        var codeEl = document.createElement('code');
        if (lang) codeEl.setAttribute('data-lang', lang.slice(0, 24));
        codeEl.textContent = buf.join('\n');
        pre.appendChild(codeEl);
        frag.appendChild(pre);
        continue;
      }

      // Línea en blanco
      if (/^\s*$/.test(line)) { i++; continue; }

      // Encabezado
      var h = RE_HEADING.exec(line);
      if (h) {
        var hEl = document.createElement('h' + h[1].length);
        inline(h[2].trim(), hEl);
        frag.appendChild(hEl);
        i++;
        continue;
      }

      // Línea horizontal
      if (RE_HR.test(line)) { frag.appendChild(document.createElement('hr')); i++; continue; }

      // Cita
      if (RE_QUOTE.test(line)) {
        var quote = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        var bq = document.createElement('blockquote');
        inline(quote.join('\n'), bq);
        frag.appendChild(bq);
        continue;
      }

      // Lista sin orden
      if (RE_UL.test(line)) {
        var ul = document.createElement('ul');
        while (i < lines.length && RE_UL.test(lines[i])) {
          var li = document.createElement('li');
          inline(lines[i].replace(RE_UL, ''), li);
          ul.appendChild(li);
          i++;
        }
        frag.appendChild(ul);
        continue;
      }

      // Lista ordenada
      if (RE_OL.test(line)) {
        var ol = document.createElement('ol');
        while (i < lines.length && RE_OL.test(lines[i])) {
          var li2 = document.createElement('li');
          inline(lines[i].replace(RE_OL, ''), li2);
          ol.appendChild(li2);
          i++;
        }
        frag.appendChild(ol);
        continue;
      }

      // Párrafo (líneas hasta blanco o inicio de otro bloque)
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      var p = document.createElement('p');
      for (var k = 0; k < para.length; k++) {
        if (k) p.appendChild(document.createElement('br'));
        inline(para[k], p);
      }
      frag.appendChild(p);
    }

    return frag;
  }

  window.renderMarkdown = render;
})();
