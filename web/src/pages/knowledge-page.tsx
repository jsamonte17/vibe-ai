import { useState } from 'react';
import { useMutation, useQuery } from 'urql';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Tag,
  Space,
  Spin,
  Typography,
} from 'antd';
import { App as AntdApp } from 'antd';

const { Paragraph, Text, Title } = Typography;

const KNOWLEDGE_ENTRIES_QUERY = `
  query KnowledgeEntries {
    knowledgeEntries {
      id
      title
      content
      tags {
        id
        name
      }
      createdAt
    }
  }
`;

const CREATE_KNOWLEDGE_ENTRY_MUTATION = `
  mutation CreateKnowledgeEntry($input: CreateKnowledgeEntryInput!) {
    createKnowledgeEntry(input: $input) {
      id
      title
      content
      tags {
        id
        name
      }
      createdAt
    }
  }
`;

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: { id: string; name: string }[];
  createdAt: string;
}

interface KnowledgeEntriesData {
  knowledgeEntries: KnowledgeEntry[];
}

interface CreateKnowledgeEntryData {
  createKnowledgeEntry: KnowledgeEntry;
}

interface CreateKnowledgeEntryVariables {
  input: {
    title: string;
    content: string;
    tags: string[];
  };
}

export function KnowledgePage() {
  const [form] = Form.useForm<CreateKnowledgeEntryVariables['input']>();
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsResult] = useQuery<{ knowledgeTags: { id: string; name: string }[] }>({
    query: `query KnowledgeTags { knowledgeTags { id name } }`,
  });
  const [queryResult, reexecuteQuery] = useQuery<KnowledgeEntriesData>({
    query: KNOWLEDGE_ENTRIES_QUERY,
  });
  const [createResult, createKnowledgeEntry] = useMutation<
    CreateKnowledgeEntryData,
    CreateKnowledgeEntryVariables
  >(CREATE_KNOWLEDGE_ENTRY_MUTATION);
  const [submitError, setSubmitError] = useState<string>();
  const { message } = AntdApp.useApp();

  const submit = async (values: CreateKnowledgeEntryVariables['input']) => {
    setSubmitError(undefined);
    const result = await createKnowledgeEntry({ input: values });

    if (result.error) {
      setSubmitError(result.error.message);
      return;
    }

    form.resetFields();
    setTagInput('');
    setSelectedTags([]);
    reexecuteQuery({ requestPolicy: 'network-only' });
    message.success('Knowledge fragment added.');
  };

  const addTag = (candidate: string) => {
    const tag = candidate.trim().replace(/,$/, '').trim();
    if (!tag) {
      return;
    }

    if (selectedTags.length >= 20) {
      message.warning('You can add up to 20 tags.');
      return;
    }

    if (selectedTags.some((current) => current.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      setTagInput('');
      return;
    }

    const updatedTags = [...selectedTags, tag];
    setSelectedTags(updatedTags);
    form.setFieldValue('tags', updatedTags);
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = selectedTags.filter(
        (tag: string) => tag.toLocaleLowerCase() !== tagToRemove.toLocaleLowerCase(),
    );
    setSelectedTags(updatedTags);
    form.setFieldValue('tags', updatedTags);
  };

  return (
    <>
      <div className="settings-section-heading">
        <Title level={3}>Knowledge base</Title>
        <Paragraph>
          Add company facts, tips, and other short pieces of knowledge for the
          assistant to use.
        </Paragraph>
      </div>
      <div className="content-grid">
        <Card title="Add knowledge" className="entry-card">
          {submitError && (
            <Alert
              type="error"
              showIcon
              message="Could not save this knowledge fragment"
              description={submitError}
              className="form-alert"
            />
          )}
          <Form
            form={form}
            initialValues={{ tags: [] }}
            layout="vertical"
            onFinish={submit}
            requiredMark="optional"
          >
            <Form.Item
              label="Title"
              name="title"
              rules={[
                { required: true, whitespace: true, message: 'Enter a title.' },
                { max: 255, message: 'Title must be 255 characters or fewer.' },
              ]}
            >
              <Input maxLength={255} placeholder="e.g. Office hours" />
            </Form.Item>
            <Form.Item
              label="Knowledge"
              name="content"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Enter the knowledge content.',
                },
              ]}
            >
              <Input.TextArea
                rows={7}
                showCount
                maxLength={20000}
                placeholder="Write one useful fact, tip, or answer..."
              />
            </Form.Item>
            <Form.Item name="tags" hidden>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item label="Group with tags">
              <Input
                value={tagInput}
                maxLength={64}
                placeholder="Type a tag and press Enter"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.includes(',')) {
                    value
                      .split(',')
                      .slice(0, -1)
                      .forEach(addTag);
                    setTagInput(value.slice(value.lastIndexOf(',') + 1));
                    return;
                  }
                  setTagInput(value);
                }}
                onPressEnter={(event) => {
                  event.preventDefault();
                  addTag(tagInput);
                }}
              />
              <div className="tag-list" aria-label="Selected tags">
                {selectedTags.map((tag) => (
                  <Tag
                    key={tag.toLocaleLowerCase()}
                    closable
                    onClose={() => removeTag(tag)}
                    color="blue"
                  >
                    {tag}
                  </Tag>
                ))}
                {tagsResult.data?.knowledgeTags
                  .filter(
                    (tag) =>
                      !selectedTags.some(
                        (selected) =>
                          selected.toLocaleLowerCase() ===
                          tag.name.toLocaleLowerCase(),
                      ),
                  )
                  .map((tag) => (
                    <Button
                      key={tag.id}
                      size="small"
                      onClick={() => addTag(tag.name)}
                    >
                      + {tag.name}
                    </Button>
                  ))}
              </div>
              <Text type="secondary" className="tag-help">
                Press Enter or type a comma to add a new tag. Click an existing
                tag to reuse it.
              </Text>
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={createResult.fetching}
              block
            >
              Save knowledge
            </Button>
          </Form>
        </Card>

        <Card
          title="Saved knowledge"
          extra={
            queryResult.data
              ? `${queryResult.data.knowledgeEntries.length} entries`
              : undefined
          }
          className="entries-card"
        >
          {queryResult.error ? (
            <Alert
              type="error"
              showIcon
              message="Could not load knowledge entries"
              description={queryResult.error.message}
            />
          ) : queryResult.fetching && !queryResult.data ? (
            <div className="loading-state">
              <Spin />
            </div>
          ) : queryResult.data?.knowledgeEntries.length ? (
            <List
              dataSource={queryResult.data.knowledgeEntries}
              renderItem={(entry) => (
                <List.Item key={entry.id}>
                  <Space direction="vertical" size={4} className="entry-item">
                    <Text strong>{entry.title}</Text>
                    <Paragraph className="entry-content">
                      {entry.content}
                    </Paragraph>
                    {entry.tags.length > 0 && (
                      <div className="tag-list">
                        {entry.tags.map((tag) => (
                          <Tag key={tag.id} color="blue">
                            {tag.name}
                          </Tag>
                        ))}
                      </div>
                    )}
                    <Text type="secondary" className="entry-date">
                      Added {new Date(entry.createdAt).toLocaleString()}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No knowledge added yet" />
          )}
        </Card>
      </div>
    </>
  );
}
