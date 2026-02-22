const Conversation = require('../models/conversation');
const Model = require('../models/model');
const User = require('../models/user');
const axios = require('axios');

/**
 * 聊天控制器
 */
const chatController = {
  /**
   * 获取用户会话列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getConversations(req, res) {
    try {
      const { user } = req.query;
      const limit = parseInt(req.query.limit) || 20;
      const lastId = req.query.last_id || null;

      // 验证用户是否存在
      const userExists = await User.findById(user);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 获取用户会话列表
      const conversations = await Conversation.getByUserId(user, limit, lastId);

      // 确定是否还有更多会话
      const hasMore = conversations.length === limit;

      res.json({
        success: true,
        data: conversations,
        has_more: hasMore,
        limit: limit
      });
    } catch (error) {
      console.error('获取会话列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，获取会话列表失败'
      });
    }
  },

  /**
   * 创建新会话
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createConversation(req, res) {
    try {
      const { model_id, user, message, title } = req.body;

      // 验证模型是否存在
      const model = await Model.getById(model_id);
      if (!model) {
        return res.status(404).json({
          success: false,
          message: '模型不存在或已禁用'
        });
      }

      // 验证用户是否存在
      const userExists = await User.findById(user);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 如果是Dify模型，需要先创建Dify会话
      let difyConversationId = req.body.dify_conversation_id || null;
      if (model.provider === 'dify' && !difyConversationId) {
        try {
          // 调用Dify API创建会话
          const difyResponse = await axios.post(
            `${model.api_url}/chat-messages`,
            {
              query: message || 'Hello',
              user: user.toString(),
              response_mode: 'blocking'
            },
            {
              headers: {
                'Authorization': `Bearer ${model.api_key}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (difyResponse.data && difyResponse.data.conversation_id) {
            difyConversationId = difyResponse.data.conversation_id;
          }
        } catch (difyError) {
          console.error('创建Dify会话失败:', difyError);
          // 继续创建本地会话，即使Dify创建失败
        }
      }

      // 创建会话标题：优先使用传入的标题，否则使用消息内容的前30个字符
      let conversationTitle;
      if (title) {
        conversationTitle = title;
      } else if (message) {
        conversationTitle = message.length > 30 ? message.substring(0, 30) + '...' : message;
      } else {
        conversationTitle = '新对话';
      }

      // 创建会话
      const conversation = await Conversation.create({
        user_id: user,
        model_id: model_id,
        title: conversationTitle,
        dify_conversation_id: difyConversationId
      });

      res.status(201).json({
        success: true,
        data: conversation
      });
    } catch (error) {
      console.error('创建会话失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，创建会话失败'
      });
    }
  },

  /**
   * 获取会话详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getConversationDetail(req, res) {
    try {
      const { conversationId } = req.params;
      const { user } = req.query;

      // 获取会话详情
      const conversation = await Conversation.getById(conversationId);

      // 会话不存在
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      // 验证用户是否有权限访问
      if (conversation.user_id !== parseInt(user)) {
        return res.status(403).json({
          success: false,
          message: '没有权限访问该会话'
        });
      }

      res.json({
        success: true,
        data: conversation
      });
    } catch (error) {
      console.error('获取会话详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，获取会话详情失败'
      });
    }
  },

  /**
   * 获取会话消息记录 - 符合Dify API规范
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getMessages(req, res) {
    try {
      const { conversation_id, first_id = null, user } = req.query;
      // 限制limit参数最大不超过100（Dify API限制）
      let limit = parseInt(req.query.limit) || 20;
      limit = Math.min(limit, 100); // 确保limit不超过100

      console.log('获取消息参数:', req.query);
      console.log('处理后的limit:', limit);

      // 验证必要参数
      if (!conversation_id) {
        return res.status(400).json({
          success: false,
          message: '会话ID不能为空'
        });
      }

      // 验证用户是否存在
      const userExists = await User.findById(user);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 获取会话详情，验证用户有权限访问该会话
      const conversation = await Conversation.getById(conversation_id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      if (conversation.user_id !== parseInt(user)) {
        return res.status(403).json({
          success: false,
          message: '无权访问该会话'
        });
      }

      // 如果是Dify会话，调用Dify API获取消息历史
      if (conversation.dify_conversation_id) {
        // 获取模型信息
        const model = await Model.getById(conversation.model_id);
        if (!model) {
          return res.status(404).json({
            success: false,
            message: '模型不存在'
          });
        }

        console.log('准备调用Dify API获取消息历史:', {
          dify_conversation_id: conversation.dify_conversation_id,
          model: model.name,
          api_url: model.api_url,
          limit: limit
        });

        try {
          // 构建Dify API请求参数 - 限制limit不超过100
          const difyParams = new URLSearchParams();
          difyParams.append('conversation_id', conversation.dify_conversation_id);
          difyParams.append('user', user.toString());
          difyParams.append('limit', limit); // 使用调整后的limit
          if (first_id) {
            difyParams.append('first_id', first_id);
          }

          console.log('Dify API请求URL:', `${model.api_url}/messages?${difyParams.toString()}`);

          // 调用Dify API获取消息
          const response = await axios.get(`${model.api_url}/messages?${difyParams.toString()}`, {
            headers: {
              'Authorization': `Bearer ${model.api_key}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('Dify API响应状态:', response.status);
          console.log('Dify API响应数据结构:', Object.keys(response.data));
          console.log('Dify API响应消息数量:', response.data.data?.length || 0);

          if (response.data.data && response.data.data.length > 0) {
            // 打印更多的调试信息
            const message = response.data.data[0];
            console.log('第一条消息示例:', JSON.stringify(message, null, 2));

            // 检查并统计消息类型
            const userMsgs = response.data.data.filter(msg => !!msg.query).length;
            const aiMsgs = response.data.data.filter(msg => !!msg.answer).length;
            console.log('消息类型统计:', {
              user: userMsgs,
              ai: aiMsgs,
              其他: response.data.data.length - userMsgs - aiMsgs
            });
          }

          // 确保返回的数据结构正确
          let messages = response.data.data || [];

          // 如果收到的消息数量很少（只有1-2条），尝试直接从Dify获取更多消息
          if (messages.length < 2 && !first_id) {
            console.log('收到消息过少，尝试获取更多历史消息');

            // 使用较大的limit值再次请求
            const moreParams = new URLSearchParams();
            moreParams.append('conversation_id', conversation.dify_conversation_id);
            moreParams.append('user', user.toString());
            moreParams.append('limit', 50); // 更大的limit

            try {
              const moreResponse = await axios.get(`${model.api_url}/messages?${moreParams.toString()}`, {
                headers: {
                  'Authorization': `Bearer ${model.api_key}`,
                  'Content-Type': 'application/json'
                }
              });

              if (moreResponse.data && moreResponse.data.data) {
                messages = moreResponse.data.data;
                console.log('第二次尝试获取更多消息，数量:', messages.length);
              }
            } catch (moreError) {
              console.error('获取更多消息失败:', moreError);
            }
          }

          // 确保消息时间正确排序 (通常用于聊天UI显示，从旧到新)
          messages = messages.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

          // 返回消息列表，保持与Dify API相同的响应格式
          return res.json({
            success: true,
            data: messages,
            has_more: response.data.has_more || false,
            limit: parseInt(limit)
          });
        } catch (apiError) {
          console.error('调用Dify API获取消息失败:', apiError);

          // 提取错误详情
          let errorMessage = '调用AI服务获取消息失败';
          if (apiError.response) {
            console.error('Dify API错误状态:', apiError.response.status);
            console.error('Dify API错误数据:', apiError.response.data);
            errorMessage = apiError.response.data?.message || errorMessage;
          }

          return res.status(500).json({
            success: false,
            message: errorMessage
          });
        }
      } else {
        // 对于非Dify会话，返回空结果
        return res.json({
          success: true,
          data: [],
          has_more: false,
          limit: parseInt(limit)
        });
      }
    } catch (error) {
      console.error('获取会话消息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，获取会话消息失败'
      });
    }
  },

  /**
   * 发送消息
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async sendMessage(req, res) {
    try {
      const { message, conversation_id, model_id, user, stream = false } = req.body;

      // 验证必要参数
      if (!message) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        });
      }

      // 获取会话和模型信息
      let conversation;
      if (conversation_id) {
        conversation = await Conversation.getById(conversation_id);
        if (!conversation) {
          return res.status(404).json({
            success: false,
            message: '会话不存在'
          });
        }

        // 验证用户是否有权限访问会话
        if (conversation.user_id !== parseInt(user)) {
          return res.status(403).json({
            success: false,
            message: '没有权限访问该会话'
          });
        }
      }

      // 获取模型信息
      const model = await Model.getById(model_id || (conversation ? conversation.model_id : null));
      if (!model) {
        return res.status(404).json({
          success: false,
          message: '模型不存在或已禁用'
        });
      }

      // 如果是Dify API
      if (model.provider === 'dify') {
        // 准备请求参数 - 按照Dify API文档重构请求体
        const requestData = {
          query: message,
          inputs: {}, // 必需的inputs字段
          response_mode: 'streaming', // 始终使用流式模式
          user: user.toString(),
          conversation_id: conversation ? conversation.dify_conversation_id : '',
          auto_generate_name: false // 禁用自动标题生成，避免额外请求
        };

        // 定义请求头
        const headers = {
          'Authorization': `Bearer ${model.api_key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        };

        // 输出API调试信息（不输出敏感字段）
        console.log('===== Dify API 调试信息 =====');
        console.log(`模型ID: ${model.id}`);
        console.log(`模型名称: ${model.name}`);
        console.log(`模型显示名称: ${model.display_name}`);
        console.log(`API URL: ${model.api_url}`);
        console.log(`提供商: ${model.provider}`);
        console.log(`完整URL: ${model.api_url}/chat-messages`);
        console.log('===========================');

        // 设置SSE相关的响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          // 使用axios发送请求并创建流式响应管道
          console.log(`正在发送请求到: ${model.api_url}/chat-messages`);
          const response = await axios({
            method: 'post',
            url: `${model.api_url}/chat-messages`,
            data: requestData,
            headers: headers,
            responseType: 'stream',
            validateStatus: function (status) {
              // 接受所有状态码，以便手动处理错误
              return true;
            }
          });

          // 处理错误状态码
          if (response.status !== 200) {
            console.error(`API返回错误状态码: ${response.status}`);

            // 尝试从流中读取错误消息
            let errorMessage = '';
            response.data.on('data', chunk => {
              errorMessage += chunk.toString('utf-8');
            });

            response.data.on('end', () => {
              console.error('错误响应内容:', errorMessage);

              // 向客户端发送错误事件
              if (!res.headersSent) {
                res.status(response.status).json({
                  success: false,
                  message: `AI服务返回错误: ${errorMessage || response.statusText}`
                });
              } else {
                res.write(`data: ${JSON.stringify({
                  event: 'error',
                  message: `AI服务返回错误: ${errorMessage || response.statusText}`,
                  status: response.status
                })}\n\n`);
                res.end();
              }
            });

            return;
          }

          // 更新会话最后一条消息
          if (conversation) {
            await Conversation.updateLastMessage(conversation_id, message.substring(0, 100));
          }

          // 添加流转换，用于调试查看响应内容
          const { PassThrough } = require('stream');
          const passThrough = new PassThrough();

          // 累积的消息缓冲区，用于解析不完整的JSON
          let messageBuffer = '';

          // 监听原始响应数据用于调试
          response.data.on('data', (chunk) => {
            const chunkStr = chunk.toString('utf-8');
            //调试信息
            //console.log('从Dify接收到原始数据:', chunkStr);

            // 处理ping事件，确保正确格式
            if (chunkStr.includes('event: ping') || chunkStr.includes('"event":"ping"')) {
              console.log('收到ping事件，不转发');
              return; // 直接返回，不转发ping事件
            }

            // 尝试解析数据以获取更多调试信息
            try {
              if (chunkStr.startsWith('data: ')) {
                const jsonStr = chunkStr.slice(6).trim();
                try {
                  const jsonData = JSON.parse(jsonStr);

                  // 如果是ping事件，直接跳过
                  if (jsonData.event === 'ping') {
                    console.log('跳过ping事件');
                    return;
                  }

                  // 解码可能存在的Unicode转义序列
                  if (jsonData.answer && typeof jsonData.answer === 'string') {
                    jsonData.answer = decodeUnicodeEscapes(jsonData.answer);
                  }
                  if (jsonData.content && typeof jsonData.content === 'string') {
                    jsonData.content = decodeUnicodeEscapes(jsonData.content);
                  }

                  if (jsonData.event === 'agent_message') {
                    //调试信息
                    //console.log('解析出agent_message:', jsonData.answer || '空内容');
                  }
                  // 原始格式正确，直接转发
                  const formattedChunk = `data: ${JSON.stringify(jsonData)}\n\n`;
                  passThrough.write(formattedChunk);
                } catch (jsonErr) {
                  console.log('JSON解析失败，按原样转发');
                  passThrough.write(chunkStr);
                }
              } else if (chunkStr.trim()) {
                // 如果数据非空但不是正确的SSE格式，添加前缀和后缀
                console.log('修正SSE格式:', chunkStr);
                // 尝试识别JSON并转换为SSE格式
                try {
                  const jsonData = JSON.parse(chunkStr);
                  console.log('已解析为JSON:', jsonData);

                  // 如果是ping事件，直接跳过
                  if (jsonData.event === 'ping') {
                    console.log('跳过ping事件');
                    return;
                  }

                  // 解码Unicode转义序列
                  if (jsonData.answer && typeof jsonData.answer === 'string') {
                    jsonData.answer = decodeUnicodeEscapes(jsonData.answer);
                  }
                  if (jsonData.content && typeof jsonData.content === 'string') {
                    jsonData.content = decodeUnicodeEscapes(jsonData.content);
                  }

                  // 添加event字段如果没有
                  if (!jsonData.event) {
                    jsonData.event = 'message';
                  }
                  const formattedChunk = `data: ${JSON.stringify(jsonData)}\n\n`;
                  console.log('格式化后:', formattedChunk);
                  passThrough.write(formattedChunk);
                } catch (jsonErr) {
                  // 不是有效JSON，作为纯文本包装
                  console.log('非JSON格式，作为文本包装');
                  const textMessage = {
                    event: 'message',
                    content: decodeUnicodeEscapes(chunkStr), // 解码文本内容
                    timestamp: Date.now()
                  };
                  const formattedChunk = `data: ${JSON.stringify(textMessage)}\n\n`;
                  console.log('文本包装后:', formattedChunk);
                  passThrough.write(formattedChunk);
                }
              }
            } catch (e) {
              console.error('处理/转发数据块时出错:', e);
              // 跳过ping事件
              if (chunkStr.includes('ping')) {
                return;
              }
              // 尝试以SSE格式直接发送原始内容
              // 确保所有内容都经过Unicode转义序列解码
              const safeContent = decodeUnicodeEscapes(chunkStr.replace(/"/g, '\\"'));
              const safeChunk = `data: {"event":"message","content":"${safeContent}"}\n\n`;
              passThrough.write(safeChunk);
            }
          });

          // 处理结束和错误事件
          response.data.on('end', () => {
            console.log('Dify API流式响应结束，发送结束事件');
            // 发送一个明确的结束事件
            try {
              passThrough.write(`data: {"event":"message_end","answer":"","message_id":"end-${Date.now()}"}\n\n`);
              passThrough.end();
            } catch (e) {
              console.error('发送结束事件失败:', e);
              passThrough.end();
            }
          });

          response.data.on('error', (error) => {
            console.error('Dify API流式响应错误:', error);
            passThrough.emit('error', error);
          });

          // 将处理后的流传递给客户端
          passThrough.pipe(res);

          // 客户端断开连接的处理
          req.on('close', () => {
            console.log('客户端关闭连接');
            response.data.destroy();
            passThrough.destroy();
          });
        } catch (error) {
          console.error('发送流式请求到Dify API失败:', error);

          // 打印完整错误信息
          if (error.response) {
            // 服务器响应了错误状态码
            console.error('API错误状态码:', error.response.status);
            console.error('API错误响应数据:', error.response.data);
          } else if (error.request) {
            // 请求已发出但没有收到响应
            console.error('没有收到API响应:', error.request);
          }

          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: `连接到AI服务失败: ${error.message}`
            });
          } else {
            res.write(`data: ${JSON.stringify({
              event: 'error',
              message: `连接到AI服务失败: ${error.message}`,
              status: 500
            })}\n\n`);
            res.end();
          }
        }
      } else {
        // 其他模型提供商的处理逻辑
        res.status(400).json({
          success: false,
          message: `不支持的模型提供商: ${model.provider}`
        });
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      // 检查响应是否已经开始发送
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '服务器错误，发送消息失败'
        });
      } else {
        // 如果已经开始发送流式响应，则发送错误事件
        res.write(`data: ${JSON.stringify({
          event: 'error',
          message: '服务器处理错误',
          status: 500
        })}\n\n`);
        res.end();
      }
    }
  },

  /**
   * 停止消息生成
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async stopMessageGeneration(req, res) {
    try {
      const { taskId } = req.params;
      const { user, model_id } = req.body;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: '任务ID不能为空'
        });
      }

      // 获取模型信息
      const model = await Model.getById(model_id);
      if (!model) {
        return res.status(404).json({
          success: false,
          message: '模型不存在或已禁用'
        });
      }

      // 调用Dify API停止响应
      if (model.provider === 'dify') {
        await axios.post(
          `${model.api_url}/chat-messages/${taskId}/stop`,
          { user: user.toString() },
          {
            headers: {
              'Authorization': `Bearer ${model.api_key}`,
              'Content-Type': 'application/json'
            }
          }
        );

        res.json({
          success: true,
          message: '已停止消息生成'
        });
      } else {
        res.status(400).json({
          success: false,
          message: `不支持的模型提供商: ${model.provider}`
        });
      }
    } catch (error) {
      console.error('停止消息生成失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，停止消息生成失败'
      });
    }
  },

  /**
   * 更新会话标题
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateConversationTitle(req, res) {
    try {
      const { conversationId } = req.params;
      const { title, user } = req.body;

      // 验证必要参数
      if (!title) {
        return res.status(400).json({
          success: false,
          message: '标题不能为空'
        });
      }

      // 更新标题
      const updated = await Conversation.updateTitle(conversationId, title, parseInt(user));

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: '会话不存在或无权限修改'
        });
      }

      // 获取更新后的会话
      const conversation = await Conversation.getById(conversationId);

      res.json({
        success: true,
        data: conversation
      });
    } catch (error) {
      console.error('更新会话标题失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，更新会话标题失败'
      });
    }
  },

  /**
   * 删除会话
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { user } = req.body;

      // 删除会话
      const deleted = await Conversation.delete(conversationId, parseInt(user));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: '会话不存在或无权限删除'
        });
      }

      res.json({
        success: true,
        message: '会话已删除'
      });
    } catch (error) {
      console.error('删除会话失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，删除会话失败'
      });
    }
  }
};

/**
 * 解码Unicode转义序列
 * @param {string} str - 可能包含Unicode转义序列的字符串
 * @returns {string} 解码后的字符串
 */
function decodeUnicodeEscapes(str) {
  if (!str || typeof str !== 'string') return str;

  try {
    // 处理形如 \uXXXX 的Unicode转义序列
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  } catch (e) {
    console.error('Unicode解码失败:', e);
    return str; // 解码失败返回原字符串
  }
}

module.exports = chatController;