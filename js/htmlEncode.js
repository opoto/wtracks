/*
HTMLEncode - Encode HTML special characters.
Copyright (c) 2006 Thomas Peri, http://www.tumuski.com/

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The Software shall be used for Good, not Evil.

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * HTML-Encode the supplied input
 * 
 * Parameters:
 *
 * (String)  source    The text to be encoded.
 * 
 * (boolean) display   The output is intended for display.
 *
 *                     If true:
 *                     * Tabs will be expanded to the number of spaces 
 *                       indicated by the 'tabs' argument.
 *                     * Line breaks will be converted to <br />.
 *
 *                     If false:
 *                     * Tabs and linebreaks get turned into &#____;
 *                       entities just like all other control characters.
 *
 * (integer) tabs      The number of spaces to expand tabs to.  (Ignored 
 *                     when the 'display' parameter evaluates to false.)
 *
 * v 0.3 - January 4, 2006
 */
function htmlEncode(source, display, tabs)
{
	function special(source)
	{
		var result = '';
		for (var i = 0; i < source.length; i++)
		{
			var c = source.charAt(i);
			if (c < ' ' || c > '~')
			{
				c = '&#' + c.charCodeAt() + ';';
			}
			result += c;
		}
		return result;
	}
	
	function format(source)
	{
		// Use only integer part of tabs, and default to 4
		tabs = (tabs >= 0) ? Math.floor(tabs) : 4;
		
		// split along line breaks
		var lines = source.split(/\r\n|\r|\n/);
		
		// expand tabs
		for (var i = 0; i < lines.length; i++)
		{
			var line = lines[i];
			var newLine = '';
			for (var p = 0; p < line.length; p++)
			{
				var c = line.charAt(p);
				if (c === '\t')
				{
					var spaces = tabs - (newLine.length % tabs);
					for (var s = 0; s < spaces; s++)
					{
						newLine += ' ';
					}
				}
				else
				{
					newLine += c;
				}
			}
			// If a line starts or ends with a space, it evaporates in html
			// unless it's an nbsp.
			newLine = newLine.replace(/(^ )|( $)/g, '&nbsp;');
			lines[i] = newLine;
		}
		
		// re-join lines
		var result = lines.join('<br />');
		
		// break up contiguous blocks of spaces with non-breaking spaces
		result = result.replace(/  /g, ' &nbsp;');
		
		// tada!
		return result;
	}

	var result = source;
	
	// ampersands (&)
	result = result.replace(/\&/g,'&amp;');

	// less-thans (<)
	result = result.replace(/\</g,'&lt;');

	// greater-thans (>)
	result = result.replace(/\>/g,'&gt;');
	
	if (display)
	{
		// format for display
		result = format(result);
	}
	else
	{
		// Replace quotes if it isn't for display,
		// since it's probably going in an html attribute.
		result = result.replace(new RegExp('"','g'), '&quot;');
		result = result.replace(new RegExp("'",'g'), '&apos;');
	}

	// special characters
	result = special(result);
	
	// tada!
	return result;
}

// Olivier:
function htmlDecode(str) {
  var div = document.createElement("div");
  div.innerHTML = str
  return div.innerHTML
}
