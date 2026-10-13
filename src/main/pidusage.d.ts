declare module 'pidusage' {
  interface Stat {
    cpu: number
    memory: number
    ppid: number
    pid: number
    ctime: number
    elapsed: number
    timestamp: number
  }
  function pidusage(pids: number | number[]): Promise<Record<string, Stat>>
  export default pidusage
}
