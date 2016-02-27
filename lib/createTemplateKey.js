'use strict';

module.exports = function createTemplateKey(s) {
	let nHash = 0;
	const strlen = s.length;
	if (strlen === 0) {
		return nHash;
	}
	for (let i = 0, n; i < strlen; ++i) {
		n = s.charCodeAt(i);
		nHash = ((nHash << 5) - nHash) + n;
		nHash = nHash & nHash;
	}
	return nHash >>> 0;
};
