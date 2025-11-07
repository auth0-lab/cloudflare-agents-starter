// Stub for node:os module in Cloudflare Workers test environment
export const platform = () => "linux";
export const release = () => "0.0.0";
export const type = () => "Linux";
export const arch = () => "x64";
export const cpus = () => [];
export const endianness = () => "LE";
export const freemem = () => 0;
export const homedir = () => "/home";
export const hostname = () => "localhost";
export const loadavg = () => [0, 0, 0];
export const networkInterfaces = () => ({});
export const tmpdir = () => "/tmp";
export const totalmem = () => 0;
export const uptime = () => 0;
export const userInfo = () => ({
  username: "test",
  uid: 1000,
  gid: 1000,
  shell: "/bin/bash",
  homedir: "/home/test",
});

export default {
  platform,
  release,
  type,
  arch,
  cpus,
  endianness,
  freemem,
  homedir,
  hostname,
  loadavg,
  networkInterfaces,
  tmpdir,
  totalmem,
  uptime,
  userInfo,
};
