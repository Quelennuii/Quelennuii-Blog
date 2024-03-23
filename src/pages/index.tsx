import Link from '@/components/Link'
import { PageSEO } from '@/components/SEO'
import siteMetadata from '@/data/siteMetadata'
import { getAllFilesFrontMatter } from '@/lib/mdx'
import { GetStaticProps, InferGetStaticPropsType } from 'next'
import { PostFrontMatter } from 'types/PostFrontMatter'
import NewsletterForm from '@/components/NewsletterForm'
// import Article from '@/components/Article'
import Card from '@/components/Card'

// const MAX_DISPLAY = 5

export const getStaticProps: GetStaticProps<{ posts: PostFrontMatter[] }> = async () => {
  const posts = await getAllFilesFrontMatter('blog')

  return { props: { posts } }
}

export default function Home({ posts }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <PageSEO title={siteMetadata.title} description={siteMetadata.description} />
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <div className="space-y-2 pb-8 pt-6 md:space-y-5">
          <h1 className="text-3xl font-extrabold leading-9 tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14">
            ヾ(•ω•`)o
          </h1>
          <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
            {siteMetadata.description}
          </p>
        </div>
        <div className="flex">
          <Card
            description={'梦里想夜里哭做梦都想去东蛋'}
            imgSrc={'/static/images/oor.jpg'}
            href={
              'https://www.bilibili.com/video/BV11P411N7nF/?spm_id_from=333.337.search-card.all.click&vd_source=83bd3864b056291a0ead94a5a56f7bef'
            }
            title={'OOR你发誓今年还来😭'}
          />
          <Card
            description={'Sorry我担livehouse天花板🥰'}
            imgSrc={'/static/images/lxt.jpg'}
            href={
              'https://www.bilibili.com/video/BV1Ju411L7Sr/?spm_id_from=333.337.search-card.all.click&vd_source=83bd3864b056291a0ead94a5a56f7bef'
            }
            title={'谁不看旅行团现场谁后悔一辈子'}
          />
          <Card
            description={'除了票版'}
            imgSrc={'/static/images/hh.jpg'}
            href={
              'https://www.bilibili.com/bangumi/play/ep334875?theme=movie&spm_id_from=333.788.recommend_more_video.-1&from_spmid=666.25.episode.0'
            }
            title={'法红黑真的是方方面面都特别完美的剧'}
          />
        </div>
        {/* <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {!posts.length && '暂无数据'}
          {posts.slice(0, MAX_DISPLAY).map((frontMatter) => {
            const { slug } = frontMatter
            return <Article {...frontMatter} key={slug} />
          })}
        </ul> */}
      </div>
      {/* {posts.length > MAX_DISPLAY && (
        <div className="flex justify-end text-base font-medium leading-6">
          <Link
            href="/blog"
            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
            aria-label="全部文章"
          >
            全部文章 (☞ﾟヮﾟ)☞;
          </Link>
        </div>
      )} */}
      {siteMetadata.newsletter.provider !== '' && (
        <div className="flex items-center justify-center pt-4">
          <NewsletterForm />
        </div>
      )}
    </>
  )
}
