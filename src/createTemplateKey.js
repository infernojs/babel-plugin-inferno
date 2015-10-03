module.exports = function createTemplateKey(s) {
	var nHash = 0, strlen = s.length;
	if (strlen === 0) return nHash;
	for (var i=0, n; i<strlen; ++i) {
		n = s.charCodeAt(i);
		nHash = ((nHash<<5)-nHash)+n;
		nHash = nHash & nHash;
	}
	return nHash >>> 0;
}