import { getRepoInfo } from './services/github';

// 測試自己的 repo
getRepoInfo('xu3clayu83ire', 'alai-yt-to-mail').then(info => {
  console.log('name:', info.name);
  console.log('stars:', info.stars);
  console.log('commits:', info.commits.length);
  console.log('first commit:', info.commits[0].message);
}).catch(console.error);