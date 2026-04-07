# BUILD_PLAN

   ## 任务

   ### T-001 (优先级: 1): 添加优先级字段到数据库
   **描述**: As a developer, I need to store task priority so it persists across sessions.
   **验收标准**:
   - [ ] 在 tasks 表中添加 priority 列：类型 `VARCHAR(10)` 或 `ENUM('high','medium','low')`
   - [ ] 默认值设为 'medium'
   - [ ] 创建并运行数据库迁移脚本
   - [ ] 迁移可安全回滚
   - [ ] 类型检查通过
   **依赖**: 无
   **规模**: 小

   ### T-002 (优先级: 2): 更新任务模型和类型定义
   **描述**: As a developer, I need the application code to reflect the new priority field.
   **验收标准**:
   - [ ] 更新 `src/lib/types/task.ts` 中的 Task 接口，添加 `priority: 'high' | 'medium' | 'low'` 属性
   - [ ] 更新 ORM 模型定义（如适用）
   - [ ] 更新任务创建/更新的验证逻辑
   - [ ] 类型检查通过
   **依赖**: T-001
   **规模**: 小

   ### T-003 (优先级: 3): 在任务创建表单中添加优先级选择器
   **描述**: As a user, I want to set priority when creating a new task.
   **验收标准**:
   - [ ] 新建任务表单中包含优先级下拉菜单，选项：高、中、低
   - [ ] 默认选中“中”
   - [ ] 表单提交数据中包含 priority 字段
   - [ ] 类型检查通过
   - [ ] **浏览器验证**：使用 dev‑browser 技能确认 UI 正常工作
   **依赖**: T-002
   **规模**: 小

   ### T-004 (优先级: 4): 在任务编辑表单中添加优先级选择器
   **描述**: As a user, I want to change priority when editing an existing task.
   **验收标准**:
   - [ ] 编辑表单中显示当前任务的优先级并允许修改
   - [ ] 保存后立即更新数据库
   - [ ] 类型检查通过
   - [ ] **浏览器验证**：使用 dev‑browser 技能确认 UI 正常工作
   **依赖**: T-003
   **规模**: 小

   ### T-005 (优先级: 5): 在任务列表项中显示优先级徽章
   **描述**: As a user, I want to see task priority at a glance in the task list.
   **验收标准**:
   - [ ] 每个任务卡片/行旁显示彩色优先级徽章
   - [ ] 徽章颜色：红色=高，黄色=中，灰色=低
   - [ ] 鼠标悬停显示优先级文本提示
   - [ ] 类型检查通过
   - [ ] **浏览器验证**：使用 dev‑browser 技能确认徽章显示正确
   **依赖**: T-002
   **规模**: 小

   ### T-006 (优先级: 6): 添加按优先级筛选任务的功能
   **描述**: As a user, I want to filter the task list to see only tasks of a certain priority.
   **验收标准**:
   - [ ] 任务列表上方添加筛选下拉菜单，选项：全部、高、中、低
   - [ ] 筛选状态保存在 URL 参数中
   - [ ] 筛选后列表正确更新
   - [ ] 类型检查通过
   - [ ] **浏览器验证**：使用 dev‑browser 技能确认筛选功能正常工作
   **依赖**: T-005
   **规模**: 中