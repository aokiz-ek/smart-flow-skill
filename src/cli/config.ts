/**
 * .ethanrc.json 配置文件的读写与类型定义
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EthanConfig {
  /** 输出语言：zh（中文，默认）或 en（英文） */
  lang?: 'zh' | 'en';
  /** 禁用的 Skill ID 列表 */
  disabledSkills?: string[];
  /** 自定义触发词映射，key 为触发词，value 为 Skill ID */
  customTriggers?: Record<string, string>;
  /** 已安装的插件包名列表 */
  plugins?: string[];
}

const CONFIG_FILE = '.ethanrc.json';

/**
 * 从当前工作目录（或指定目录）读取配置
 */
export function readConfig(cwd: string = process.cwd()): EthanConfig {
  const configPath = path.join(cwd, CONFIG_FILE);
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw) as EthanConfig;
    }
  } catch {
    // 配置解析失败时返回空配置
  }
  return {};
}

/**
 * 写入配置到指定目录
 */
export function writeConfig(config: EthanConfig, cwd: string = process.cwd()): void {
  const configPath = path.join(cwd, CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE);
}
